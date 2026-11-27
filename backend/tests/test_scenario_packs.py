"""Scenario packs: each pack loads, validates, is deterministic, rewards good play, and its
scenario-specific mechanic behaves as documented."""
import glob
import hashlib
import json
import os
import random

import pytest
from fastapi.testclient import TestClient

from backend.app.engine import mechanics
from backend.app.engine.loader import load_scenario, load_scenario_config
from backend.app.engine.models import Action, ActionName, EventType, PHASES
from backend.app.engine.rules import validate_action_preconditions
from backend.app.engine.step import step
from backend.app.main import app

PACKS = sorted(os.path.basename(p)[:-5] for p in glob.glob("scenarios/*.yaml"))
REQUIRED_NPCS = {"village_head", "rescue_worker", "family_member", "health_worker", "district_official"}
WAIT = Action(name=ActionName.WAIT, params={})


def A(name, **params):
    return Action(name=ActionName(name), params=params)


def path(pack):
    return f"scenarios/{pack}.yaml"


def play(pack, plan, difficulty="standard"):
    state = load_scenario(path(pack), difficulty)
    rng = random.Random(7)
    history, all_events = [], []
    while not state.is_finished:
        act = plan.get(state.tick + 1, WAIT)
        if not validate_action_preconditions(state, act)[0]:
            act = WAIT
        state, events = step(state, act, rng)
        history.append(state)
        all_events.extend(events)
    return state, history, all_events


EXPERT = {
    "village-river-01": {
        1: A("open_shelter", shelter_id="school"), 2: A("issue_warning"), 3: A("order_evacuation", zone="ward-1"),
        4: A("prioritize_vulnerable", zone="ward-1"), 5: A("assign_transport", zone="ward-1", transport_type="boat", count=2),
        6: A("assign_transport", zone="ward-2", transport_type="vehicle", count=2), 7: A("reinforce_embankment", sandbags=200),
        8: A("reinforce_embankment", sandbags=200), 9: A("order_evacuation", zone="ward-2"), 11: A("order_evacuation", zone="ward-3"),
        12: A("distribute_supplies"), 15: A("distribute_supplies"), 18: A("provide_clean_water"), 19: A("run_medical_camp"),
        20: A("damage_survey", zone="ward-2"), 21: A("clear_roads", zone="ward-2"), 22: A("restore_power"),
        23: A("return_residents", zone="ward-2"), 24: A("clear_roads", zone="ward-1"), 25: A("damage_survey", zone="ward-1"),
        26: A("return_residents", zone="ward-1"), 27: A("return_residents", zone="ward-1"), 28: A("return_residents", zone="ward-3"),
        29: A("return_residents", zone="ward-2"),
    },
    "urban-flash-flood-01": {
        1: A("open_shelter", shelter_id="community-hall"), 2: A("order_evacuation", zone="underpass-colony"),
        3: A("order_evacuation", zone="station-market"), 4: A("issue_warning"), 5: A("open_shelter", shelter_id="municipal-school"),
        6: A("reinforce_embankment", sandbags=200), 7: A("assign_transport", zone="station-market", transport_type="boat", count=2),
        8: A("clear_drains", zone="station-market"), 12: A("provide_clean_water"), 13: A("run_medical_camp"),
        14: A("search_and_rescue", zone="underpass-colony"), 15: A("distribute_supplies"), 16: A("damage_survey", zone="station-market"),
        17: A("clear_roads", zone="station-market"), 18: A("restore_power"), 19: A("return_residents", zone="station-market"),
        20: A("damage_survey", zone="underpass-colony"), 21: A("clear_roads", zone="underpass-colony"),
        22: A("return_residents", zone="underpass-colony"), 23: A("return_residents", zone="station-market"),
    },
    "dam-release-01": {
        1: A("open_shelter", shelter_id="hilltop-school"), 2: A("issue_warning"), 3: A("request_staggered_release"),
        4: A("order_evacuation", zone="ghat-village"), 5: A("order_evacuation", zone="temple-hamlet"),
        6: A("assign_transport", zone="ghat-village", transport_type="vehicle", count=2), 7: A("reinforce_embankment", sandbags=200),
        8: A("prioritize_vulnerable", zone="temple-hamlet"), 9: A("assign_transport", zone="temple-hamlet", transport_type="boat", count=3),
        10: A("reinforce_embankment", sandbags=200), 11: A("distribute_supplies"), 15: A("provide_clean_water"),
        16: A("run_medical_camp"), 17: A("damage_survey", zone="temple-hamlet"), 18: A("clear_roads", zone="temple-hamlet"),
        19: A("restore_power"), 20: A("return_residents", zone="temple-hamlet"), 21: A("damage_survey", zone="ghat-village"),
        22: A("clear_roads", zone="ghat-village"), 23: A("return_residents", zone="ghat-village"),
        24: A("return_residents", zone="ghat-village"), 25: A("distribute_supplies"), 26: A("return_residents", zone="temple-hamlet"),
    },
    "cyclone-surge-01": {
        1: A("recall_fishing_boats"), 2: A("open_shelter", shelter_id="cyclone-shelter"), 3: A("order_evacuation", zone="fishing-hamlet"),
        4: A("prioritize_vulnerable", zone="fishing-hamlet"), 5: A("assign_transport", zone="fishing-hamlet", transport_type="vehicle", count=2),
        6: A("open_shelter", shelter_id="hill-school"), 7: A("order_evacuation", zone="salt-pans"), 8: A("issue_warning"),
        9: A("order_evacuation", zone="hill-road"), 10: A("reinforce_embankment", sandbags=200), 11: A("request_external_support"),
        12: A("distribute_supplies"), 19: A("provide_clean_water"), 20: A("run_medical_camp"), 21: A("damage_survey", zone="fishing-hamlet"),
        22: A("damage_survey", zone="salt-pans"), 23: A("clear_roads", zone="salt-pans"), 24: A("restore_power"),
        25: A("return_residents", zone="salt-pans"), 26: A("clear_roads", zone="fishing-hamlet"), 27: A("return_residents", zone="fishing-hamlet"),
        28: A("return_residents", zone="fishing-hamlet"), 29: A("distribute_supplies"),
    },
}
EXPERT["river-island-01"] = {
    1: A("issue_warning"), 2: A("open_shelter", shelter_id="raised-platform"), 3: A("open_shelter", shelter_id="mainland-school"),
    4: A("order_evacuation", zone="east-char"), 5: A("prioritize_vulnerable", zone="east-char"),
    6: A("assign_transport", zone="east-char", transport_type="boat", count=3), 7: A("order_evacuation", zone="west-char"),
    8: A("reinforce_embankment", sandbags=100), 9: A("reinforce_embankment", sandbags=100), 10: A("order_evacuation", zone="ghat-bank"),
    11: A("request_external_support"), 12: A("distribute_supplies"), 15: A("distribute_supplies"), 18: A("provide_clean_water"),
    19: A("run_medical_camp"), 20: A("damage_survey", zone="west-char"), 21: A("restore_power"), 22: A("clear_roads", zone="west-char"),
    23: A("return_residents", zone="west-char"), 24: A("damage_survey", zone="east-char"), 25: A("clear_roads", zone="east-char"),
    26: A("return_residents", zone="east-char"), 27: A("return_residents", zone="east-char"), 28: A("return_residents", zone="ghat-bank"),
    29: A("return_residents", zone="west-char"),
}
EXPERT["glacial-lake-01"] = {
    1: A("issue_warning"), 2: A("open_shelter", shelter_id="ridge-camp"), 3: A("order_evacuation", zone="river-bazaar"),
    4: A("prioritize_vulnerable", zone="river-bazaar"), 5: A("assign_transport", zone="river-bazaar", transport_type="vehicle", count=3),
    6: A("open_shelter", shelter_id="monastery-hall"), 7: A("order_evacuation", zone="hydro-camp"), 8: A("order_evacuation", zone="monastery-hamlet"),
    9: A("request_external_support"), 11: A("distribute_supplies"), 14: A("distribute_supplies"), 15: A("provide_clean_water"),
    16: A("run_medical_camp"), 17: A("damage_survey", zone="river-bazaar"), 18: A("clear_roads", zone="river-bazaar"), 19: A("restore_power"),
    20: A("return_residents", zone="river-bazaar"), 21: A("return_residents", zone="river-bazaar"), 22: A("damage_survey", zone="hydro-camp"),
    23: A("clear_roads", zone="hydro-camp"), 24: A("return_residents", zone="hydro-camp"), 25: A("return_residents", zone="monastery-hamlet"),
    26: A("return_residents", zone="river-bazaar"),
}
EXPERT_MIN = {"village-river-01": 85, "dam-release-01": 75, "urban-flash-flood-01": 65, "cyclone-surge-01": 60,
              "river-island-01": 55, "glacial-lake-01": 60}


def test_all_six_packs_present():
    assert set(PACKS) >= set(EXPERT)


@pytest.mark.parametrize("pack", PACKS)
def test_pack_loads_and_validates(pack):
    cfg = load_scenario_config(path(pack))
    for diff in ("easy", "standard", "hard"):
        s = load_scenario(path(pack), diff)
        assert s.difficulty == diff and s.phase == "before" and s.tick == 0
    s = load_scenario(path(pack))
    assert len(s.forecast_cm) >= s.max_ticks
    assert s.recovery_config.enabled
    assert s.mechanic.type in ("none", "drains", "dam_release", "cyclone")
    assert REQUIRED_NPCS <= set(s.npc_ids)
    assert s.support.uses >= 1
    layout = cfg["layout"]
    assert {z["id"] for z in layout["zones"]} == set(s.zones)
    assert {sh["id"] for sh in layout["shelters"]} == set(s.shelters)
    for r in layout["routes"]:
        assert r["zone_id"] in s.zones and r["shelter_id"] in s.shelters and len(r["waypoints"]) >= 2
    lv = layout["levels"]
    assert lv["normal_level_cm"] < lv["warning_level_cm"] < lv["danger_level_cm"] <= lv["crest_level_cm"]
    for key in ("water_point", "medical_camp", "substation", "health_centre", "supply_depot"):
        assert key in layout["recovery_sites"]
    for field in ("hazard_type", "hazard_label", "hook", "illustration", "difficulty_label"):
        assert cfg.get(field)
    for npc in cfg["npcs"]:
        assert npc["location"] in s.zones or npc["location"] in s.shelters
    with pytest.raises(ValueError):
        load_scenario(path(pack), "impossible")


@pytest.mark.parametrize("pack", PACKS)
def test_pack_same_seed_same_outcome(pack):
    hashes = set()
    for _ in range(20):
        final, _, _ = play(pack, EXPERT.get(pack, {}))
        hashes.add(hashlib.sha256(json.dumps(final.model_dump(), sort_keys=True).encode()).hexdigest())
    assert len(hashes) == 1


@pytest.mark.parametrize("pack", sorted(EXPERT))
def test_pack_rewards_good_play_and_covers_three_phases(pack):
    nothing, _, _ = play(pack, {})
    expert, hist, _ = play(pack, EXPERT[pack])
    assert nothing.score.total_score < 30
    assert expert.score.total_score >= EXPERT_MIN[pack], expert.score.total_score
    assert [p for p in PHASES if any(h.phase == p for h in hist)] == list(PHASES)


def test_api_sessions_with_same_seed_are_identical():
    c = TestClient(app)
    for pack in PACKS:
        states = []
        for _ in range(2):
            sid = c.post("/api/v1/sessions", json={"scenario_id": pack, "seed": 1234, "difficulty": "hard"}).json()["session_id"]
            for _ in range(5):
                res = c.post(f"/api/v1/sessions/{sid}/turns", json={"input": {"type": "button", "action": {"name": "wait", "params": {}}}}).json()
            states.append(res["state"])
        assert states[0] == states[1]
    assert c.post("/api/v1/sessions", json={"scenario_id": PACKS[0], "difficulty": "nope"}).status_code == 400
    assert c.post("/api/v1/sessions", json={"scenario_id": PACKS[0], "language": "xx"}).status_code == 400
    listing = c.get("/api/v1/scenarios").json()["scenarios"]
    assert listing[0]["id"] == "village-river-01"
    assert {s["id"] for s in listing} == set(PACKS)
    for s in listing:
        assert s["hazard_label"] and s["hook"] and len(s["npcs"]) == 5 and s["shelters"]


# ------------------------------------------------------------------ mechanics

def test_urban_clearing_drains_reduces_flooding():
    blocked, h_blocked, _ = play("urban-flash-flood-01", {1: A("issue_warning")})
    cleared, h_cleared, ev = play("urban-flash-flood-01", {1: A("clear_drains", zone="station-market")})
    assert any(e.type == EventType.DRAINS_CLEARED for e in ev)
    for a, b in zip(h_blocked, h_cleared):
        assert b.zones["station-market"].water_depth_cm <= a.zones["station-market"].water_depth_cm
    assert cleared.zones["station-market"].max_depth_cm < blocked.zones["station-market"].max_depth_cm
    # the underpass loses road access at a much lower depth
    s = load_scenario(path("urban-flash-flood-01"))
    assert mechanics.road_cutoff_cm(s, s.zones["underpass-colony"]) < mechanics.road_cutoff_cm(s, s.zones["station-market"])


def test_dam_notice_before_release_and_staggering_lowers_peak():
    _, h_plain, ev_plain = play("dam-release-01", {})
    _, h_stag, ev_stag = play("dam-release-01", {2: A("request_staggered_release")})
    notice = [e.tick for e in ev_plain if e.type == EventType.DAM_RELEASE_NOTICE]
    start = [e.tick for e in ev_plain if e.type == EventType.DAM_RELEASE_STARTED]
    assert notice and start and notice[0] < start[0]
    assert max(h.water_level_cm for h in h_stag) < max(h.water_level_cm for h in h_plain)
    assert any(e.type == EventType.RELEASE_STAGGERED for e in ev_stag)
    # too late once the release has begun
    s = load_scenario(path("dam-release-01"))
    rng = random.Random(0)
    while s.tick < 9:
        s, _ = step(s, WAIT, rng)
    assert not validate_action_preconditions(s, A("request_staggered_release"))[0]


def test_cyclone_recall_saves_fishers_and_landfall_cuts_power():
    no_recall, _, ev = play("cyclone-surge-01", {})
    recalled, _, ev_r = play("cyclone-surge-01", {1: A("recall_fishing_boats")})
    assert no_recall.mechanic_state["fishers_stranded"] == 32
    assert any(e.type == EventType.FISHERS_STRANDED for e in ev)
    assert recalled.mechanic_state.get("fishers_stranded", 0) == 0
    assert any(e.type == EventType.FISHING_BOATS_RETURNED for e in ev_r)
    assert recalled.score.total_score > no_recall.score.total_score or no_recall.score.residents_safe_score == 0
    assert any(e.type == EventType.CYCLONE_LANDFALL for e in ev)
    assert no_recall.recovery_start_tick is not None


def test_mechanic_actions_only_in_their_scenario():
    village = load_scenario(path("village-river-01"))
    for act in (A("clear_drains", zone="ward-1"), A("request_staggered_release"), A("recall_fishing_boats")):
        ok, why = validate_action_preconditions(village, act)
        assert not ok and "does not apply" in why


# ------------------------------------------------------------------ support, resources, difficulty

def test_external_support_arrives_after_delay_once():
    s = load_scenario(path("village-river-01"))
    rng = random.Random(0)
    boats0 = s.resources.total_boats
    s, ev = step(s, A("request_external_support"), rng)
    eta = [e for e in ev if e.type == EventType.SUPPORT_REQUESTED][0].details["eta_tick"]
    assert eta == 1 + s.support.delay_ticks
    assert not validate_action_preconditions(s, A("request_external_support"))[0]
    arrived = None
    while s.tick < eta:
        s, ev = step(s, WAIT, rng)
        if any(e.type == EventType.SUPPORT_ARRIVED for e in ev):
            arrived = s.tick
    assert arrived == eta
    assert s.resources.total_boats == boats0 + s.support.boats
    assert s.support_requests_left == 0
    assert not validate_action_preconditions(s, A("request_external_support"))[0]


def test_resource_depleted_event():
    s = load_scenario(path("village-river-01"))
    _, ev = step(s, A("assign_transport", zone="ward-1", transport_type="boat", count=s.resources.available_boats), random.Random(0))
    dep = [e for e in ev if e.type == EventType.RESOURCE_DEPLETED]
    assert dep and dep[0].details["resource"] == "boats"


@pytest.mark.parametrize("pack", PACKS)
def test_difficulty_levers(pack):
    easy, std, hard = (load_scenario(path(pack), d) for d in ("easy", "standard", "hard"))
    assert easy.resources.total_boats >= std.resources.total_boats >= hard.resources.total_boats
    assert max(easy.forecast_cm) < max(std.forecast_cm) < max(hard.forecast_cm)
    assert easy.support.delay_ticks <= std.support.delay_ticks <= hard.support.delay_ticks


def test_recovery_extras_damage_and_contamination():
    final, hist, ev = play("village-river-01", EXPERT["village-river-01"])
    start = next(h for h in hist if h.phase == "recovery")
    assert start.recovery.water_contamination > 0
    assert any(z.damaged_houses > 0 for z in start.zones.values() if z.max_depth_cm > 30)
    survey = [e for e in ev if e.type == EventType.DAMAGE_SURVEYED][0]
    assert "damaged_houses" in survey.details and "houses damaged" in survey.description
    assert final.recovery.water_contamination < start.recovery.water_contamination
