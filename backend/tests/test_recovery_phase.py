"""Part 2: post-flood phase - phase timeline, gating, recovery rules, parser, API, report, replay."""
import hashlib
import json
import random

import pytest
from fastapi.testclient import TestClient

from backend.app.engine.loader import load_scenario
from backend.app.engine.step import step
from backend.app.engine.models import (
    Action, ActionName, EventType, FLOOD_ONLY_ACTIONS, RECOVERY_ONLY_ACTIONS,
)
from backend.app.engine.rules import validate_action_preconditions
from backend.app.main import app
from backend.app.services.parser import parse_action_text

from test_golden_and_metamorphic import FLOOD_EXPERT, RECOVERY_EXPERT, play, A

SCENARIO = "scenarios/village-river-01.yaml"
WAIT = Action(name=ActionName.WAIT, params={})


def _advance_to(phase, plan=None):
    state = load_scenario(SCENARIO)
    rng = random.Random(1)
    plan = plan or {}
    while state.phase != phase:
        act = plan.get(state.tick + 1, WAIT)
        if not validate_action_preconditions(state, act)[0]:
            act = WAIT
        state, _ = step(state, act, rng)
    return state


def test_scenario_version_bumped_and_recovery_enabled():
    s = load_scenario(SCENARIO)
    assert s.scenario_version == "2.0.0"
    assert s.max_ticks == 30 and len(s.forecast_cm) == 30
    assert s.recovery_config.enabled and s.phase == "before"


def test_phase_timeline():
    final, hist = play({})
    phases = [s.phase for s in hist]
    assert final.flood_start_tick == 4  # Ward 1 starts flooding at 235 cm
    assert final.recovery_start_tick == 17  # first tick below 380 cm after the 475 cm peak
    assert phases[:3] == ["before"] * 3
    assert set(phases[3:16]) == {"flood"}
    assert set(phases[16:]) == {"recovery"}


def test_flood_actions_rejected_in_recovery_and_recovery_actions_before():
    before = load_scenario(SCENARIO)
    for name in RECOVERY_ONLY_ACTIONS:
        ok, why = validate_action_preconditions(before, Action(name=name, params={"zone": "ward-1"}))
        assert not ok and "Recovery actions" in why
    rec = _advance_to("recovery")
    for name in FLOOD_ONLY_ACTIONS:
        params = {"zone": "ward-1", "transport_type": "boat", "count": 1, "sandbags": 100}
        ok, why = validate_action_preconditions(rec, Action(name=name, params=params))
        assert not ok and "flood response phase is over" in why
    for name in (ActionName.WAIT, ActionName.CONSULT_NPC):
        params = {"npc_id": "village_head"} if name == ActionName.CONSULT_NPC else {}
        assert validate_action_preconditions(rec, Action(name=name, params=params))[0]


def test_recovery_start_releases_transport_and_sets_damage():
    state = _advance_to("recovery", FLOOD_EXPERT)
    assert state.resources.available_boats == state.resources.total_boats
    assert all(z.boats_assigned == 0 and z.vehicles_assigned == 0 for z in state.zones.values())
    blocked = {zid for zid, z in state.zones.items() if z.road_blocked}
    assert blocked == {zid for zid, z in state.zones.items() if z.max_depth_cm >= 30}
    assert not state.recovery.power_on  # deep water in at least one ward
    assert state.recovery.disease_risk == state.recovery.peak_disease_risk > 0


def test_recovery_action_chain_and_preconditions():
    s = _advance_to("recovery", FLOOD_EXPERT)
    rng = random.Random(5)
    # Power needs a cleared road first
    ok, why = validate_action_preconditions(s, A("restore_power"))
    assert not ok and "Clear at least one road" in why
    # Ward 1 is still deep: road cannot be cleared and residents cannot return
    assert not validate_action_preconditions(s, A("clear_roads", zone="ward-1"))[0]
    assert not validate_action_preconditions(s, A("return_residents", zone="ward-1"))[0]
    # Ward 3 never flooded: no survey or rescue needed
    assert not validate_action_preconditions(s, A("damage_survey", zone="ward-3"))[0]
    assert not validate_action_preconditions(s, A("search_and_rescue", zone="ward-3"))[0]
    # Ward 2 dries at tick 18
    s, _ = step(s, WAIT, rng)
    assert s.zones["ward-2"].water_depth_cm == 0
    ok, why = validate_action_preconditions(s, A("return_residents", zone="ward-2"))
    assert not ok and ("blocked" in why or "survey" in why)
    for act in (A("clear_roads", zone="ward-2"), A("damage_survey", zone="ward-2"), A("restore_power")):
        assert validate_action_preconditions(s, act)[0], act
        s, events = step(s, act, rng)
    types = [e.type for e in events]
    assert EventType.POWER_RESTORED in types and EventType.HEALTH_CENTRE_REOPENED in types
    assert s.recovery.power_on and s.recovery.health_centre_open
    in_shelter = s.zones["ward-2"].safe_evacuated - s.zones["ward-2"].returned
    s, events = step(s, A("return_residents", zone="ward-2"), rng)
    ret = [e for e in events if e.type == EventType.RESIDENTS_RETURNED][0]
    assert ret.details["returned"] == min(in_shelter, 100)


def test_search_and_rescue_brings_stranded_residents_to_shelter():
    plan = {1: A("open_shelter", shelter_id="school")}  # shelter open but nobody ordered out
    s = _advance_to("recovery", plan)
    stranded = [zid for zid, z in s.zones.items() if z.population_remaining > 0 and z.max_depth_cm > 0]
    assert stranded
    zid = stranded[0]
    before = s.zones[zid]
    s2, events = step(s, A("search_and_rescue", zone=zid), random.Random(0))
    ev = [e for e in events if e.type == EventType.SEARCH_AND_RESCUE_COMPLETED][0]
    n = ev.details["rescued"]
    assert n > 0
    assert s2.zones[zid].population_remaining == before.population_remaining - n
    assert s2.zones[zid].safe_evacuated == before.safe_evacuated + n
    assert ev.details["vulnerable_included"] == min(n, before.vulnerable_remaining)


def test_no_clean_water_leads_to_high_risk_and_illness():
    final, hist = play({})
    events_seen = set()
    s = load_scenario(SCENARIO)
    rng = random.Random(123)
    while not s.is_finished:
        s, evs = step(s, WAIT, rng)
        events_seen.update(e.type for e in evs)
    assert EventType.DISEASE_RISK_HIGH in events_seen
    assert EventType.ILLNESS_REPORTED in events_seen
    assert final.recovery.illness_cases > 0 and final.score.public_health_score == 0


def test_supplies_consumed_while_people_are_sheltered():
    final, hist = play(FLOOD_EXPERT)
    assert final.recovery.supply_shortfall_ticks > 0  # never resupplied
    with_supplies, _ = play({**FLOOD_EXPERT, **RECOVERY_EXPERT})
    assert with_supplies.recovery.supply_shortfall_ticks < final.recovery.supply_shortfall_ticks


def test_full_game_determinism_100_runs():
    plan = {**FLOOD_EXPERT, **RECOVERY_EXPERT}
    hashes = set()
    for _ in range(100):
        final, _ = play(plan)
        hashes.add(hashlib.sha256(json.dumps(final.model_dump(), sort_keys=True).encode()).hexdigest())
    assert len(hashes) == 1


@pytest.mark.parametrize("text,action,zone", [
    ("provide clean drinking water", "provide_clean_water", None),
    ("set up a medical camp", "run_medical_camp", None),
    ("clear the road to ward 2", "clear_roads", "ward-2"),
    ("survey damage in ward 2", "damage_survey", "ward-2"),
    ("send relief supplies", "distribute_supplies", None),
    ("rashan bhejo", "distribute_supplies", None),
])
def test_parser_recovery_phrases(text, action, zone):
    s = _advance_to("recovery", FLOOD_EXPERT)
    s, _ = step(s, WAIT, random.Random(0))  # tick 18: Ward 2 is dry
    status, act, clarify, reason = parse_action_text(text, s)
    assert status == "ok", (status, reason, clarify)
    assert act.name.value == action
    assert act.params.get("zone") == zone


def test_parser_recovery_action_without_zone_asks():
    s = _advance_to("recovery", FLOOD_EXPERT)
    status, act, clarify, _ = parse_action_text("search and rescue", s)
    assert status == "clarify" and len(clarify["options"]) == 3
    status, *_ = parse_action_text("clear out lowland ward 1", load_scenario(SCENARIO))
    assert status in ("ok", "rejected")  # still an evacuation phrase, not clear_roads


def test_api_full_session_replay_report_and_summary(tmp_path):
    client = TestClient(app)
    sid = client.post("/api/v1/sessions", json={"scenario_id": "village-river-01", "seed": 77}).json()["session_id"]
    plan = {**FLOOD_EXPERT, **RECOVERY_EXPERT}
    tick = 0
    res = None
    while True:
        act = plan.get(tick + 1, WAIT)
        res = client.post(f"/api/v1/sessions/{sid}/turns",
                          json={"input": {"type": "button", "action": {"name": act.name.value, "params": act.params}}}).json()
        assert res["status"] == "ok", res.get("reject_reason")
        tick = res["state"]["tick"]
        assert res["summary"]["phase"] == res["state"]["phase"]
        assert res["summary"]["recovery"]["community_trust"] == res["state"]["recovery"]["community_trust"]
        if res["state"]["is_finished"]:
            break
    assert tick == 30

    # Replay from /log reproduces the exact final state, recovery included
    log = client.get(f"/api/v1/sessions/{sid}/log").json()
    replay = load_scenario(SCENARIO)
    rng = random.Random(0)
    for a in log["actions"]:
        replay, _ = step(replay, Action(name=ActionName(a["name"]), params=a["params"]), rng)
    assert replay.model_dump() == res["state"]
    assert {e["details"]["phase"] for e in log["events"]} == {"before", "flood", "recovery"}

    report = client.get(f"/api/v1/sessions/{sid}/report").json()
    assert [p["phase"] for p in report["phases"]] == ["before", "flood", "recovery"]
    assert sum(p["score_max"] for p in report["phases"]) == 100
    assert sum(p["score_points"] for p in report["phases"]) == report["score"]["total_score"]
    chain_phases = {link["phase"] for link in report["causal_chain"]}
    assert {"before", "flood", "recovery"} <= chain_phases
    effects = {(l["cause"]["type"], l["effect"]["type"]) for l in report["causal_chain"]}
    assert ("road_cleared", "power_restored") in effects
    assert ("damage_surveyed", "residents_returned") in effects
    assert "112" in report["disclaimer"]

    layout = client.get(f"/api/v1/sessions/{sid}/state").json()["layout"]
    assert {"water_point", "medical_camp", "substation", "health_centre", "supply_depot"} <= set(layout["recovery_sites"])
