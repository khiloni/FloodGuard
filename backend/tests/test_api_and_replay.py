import random
import pytest
from backend.app.main import (
    get_health,
    get_meta,
    list_scenarios,
    create_session,
    submit_turn,
    get_session_state,
    get_session_report,
    CreateSessionRequest,
    TurnRequest,
)
from backend.app.engine.loader import load_scenario
from backend.app.engine.step import step
from backend.app.engine.models import Action, ActionName


def test_api_meta_and_health():
    h = get_health()
    assert h["status"] == "ok"
    assert "llm_mode" in h

    m = get_meta()
    assert "112" in m["disclaimer"]
    assert "educational simulation" in m["disclaimer"].lower()

    sc = list_scenarios()
    assert len(sc["scenarios"]) >= 1
    assert sc["scenarios"][0]["id"] == "village-river-01"


def test_api_session_lifecycle_and_turn():
    # 1. Create session
    req = CreateSessionRequest(scenario_id="village-river-01")
    sess_data = create_session(req)
    session_id = sess_data["session_id"]
    assert sess_data["state"]["tick"] == 0

    # 2. Submit button turn
    btn_turn = TurnRequest(
        input={"type": "button", "action": {"name": "open_shelter", "params": {"shelter_id": "school"}}}
    )
    turn_res = submit_turn(session_id, btn_turn)
    assert turn_res["status"] == "ok"
    assert turn_res["state"]["tick"] == 1
    assert turn_res["state"]["shelters"]["school"]["is_open"] is True

    # 3. Submit natural language turn (F2 free text)
    txt_turn = TurnRequest(input={"type": "text", "text": "evacuate ward 1"})
    turn_res = submit_turn(session_id, txt_turn)
    assert turn_res["status"] == "ok"
    assert turn_res["state"]["tick"] == 2
    assert turn_res["state"]["zones"]["ward-1"]["evacuation_ordered"] is True

    # 4. Check After-Action Report
    report = get_session_report(session_id)
    assert "score" in report
    assert 0 <= report["score"]["total_score"] <= 100


def test_session_replay_integrity():
    """Replay test: Rebuilding session from (scenario, seed, actions) must exactly match live final state."""
    req = CreateSessionRequest(scenario_id="village-river-01", seed=777)
    sess_data = create_session(req)
    session_id = sess_data["session_id"]

    actions_payload = [
        {"type": "button", "action": {"name": "open_shelter", "params": {"shelter_id": "school"}}},
        {"type": "button", "action": {"name": "issue_warning", "params": {}}},
        {"type": "button", "action": {"name": "order_evacuation", "params": {"zone": "ward-1"}}},
        {"type": "button", "action": {"name": "assign_transport", "params": {"zone": "ward-1", "transport_type": "boat", "count": 2}}},
        {"type": "button", "action": {"name": "reinforce_embankment", "params": {"sandbags": 100}}},
    ]

    for p in actions_payload:
        submit_turn(session_id, TurnRequest(input=p))

    # Fetch live final state
    live_res = get_session_state(session_id)
    live_state = live_res["state"]

    # Replay independently from scratch
    replayed_state = load_scenario("scenarios/village-river-01.yaml")
    rng = random.Random(777)
    for p in actions_payload:
        act_info = p["action"]
        act = Action(name=ActionName(act_info["name"]), params=act_info["params"])
        replayed_state, _ = step(replayed_state, act, rng)

    assert live_state["tick"] == replayed_state.tick
    assert live_state["water_level_cm"] == replayed_state.water_level_cm
    for zid in live_state["zones"]:
        assert live_state["zones"][zid]["safe_evacuated"] == replayed_state.zones[zid].safe_evacuated
        assert live_state["zones"][zid]["population_remaining"] == replayed_state.zones[zid].population_remaining
