import asyncio
import json
import os
import random
import httpx
import pytest
from backend.app.main import (
    app,
    get_health,
    get_meta,
    list_scenarios,
    create_session,
    submit_turn,
    get_session_state,
    get_session_report,
    get_session_log,
    MAX_INPUT_CHARS,
    CreateSessionRequest,
    TurnRequest,
)
from backend.app.engine.loader import load_scenario
from backend.app.engine.step import step
from backend.app.engine.models import Action, ActionName
from backend.app.llm.openai_compat import reset_circuit_breaker


@pytest.fixture(autouse=True)
def _isolate_template_mode(monkeypatch):
    monkeypatch.setenv("LLM_MODE", "template")
    reset_circuit_breaker()
    yield
    reset_circuit_breaker()


def test_api_meta_and_health():
    h = get_health()
    assert h["status"] == "ok"
    assert "llm_mode" in h

    m = get_meta()
    assert "112" in m["disclaimer"]
    assert "educational simulation" in m["disclaimer"].lower()
    assert "example_commands" in m
    assert len(m["example_commands"]) == 8

    sc = list_scenarios()
    assert len(sc["scenarios"]) >= 1
    s0 = sc["scenarios"][0]
    assert s0["id"] == "village-river-01"
    assert "layout" in s0
    assert s0["layout"]["canvas"]["width"] == 1000
    assert s0["layout"]["canvas"]["height"] == 600
    assert "river" in s0["layout"]
    assert "embankment" in s0["layout"]
    assert "zones" in s0["layout"]
    assert "shelters" in s0["layout"]
    assert "routes" in s0["layout"]


def test_api_session_lifecycle_and_turn():
    # 1. Create session
    req = CreateSessionRequest(scenario_id="village-river-01")
    sess_data = create_session(req)
    session_id = sess_data["session_id"]
    assert sess_data["state"]["tick"] == 0
    assert "layout" in sess_data
    assert "summary" in sess_data
    assert "transport" in sess_data["summary"]
    assert sess_data["summary"]["transport"]["boats_available"] == 2

    # 2. Submit button turn
    btn_turn = TurnRequest(
        input={"type": "button", "action": {"name": "open_shelter", "params": {"shelter_id": "school"}}}
    )
    turn_res = submit_turn(session_id, btn_turn)
    assert turn_res["status"] == "ok"
    assert turn_res["state"]["tick"] == 1
    assert turn_res["state"]["shelters"]["school"]["is_open"] is True
    assert "layout" in turn_res
    assert "summary" in turn_res
    for ev in turn_res["events"]:
        assert "type" in ev
        assert "tick" in ev
        assert "caused_by" in ev
        assert ("zone" in ev or "target" in ev)

    # 3. Submit natural language turn (F2 free text)
    txt_turn = TurnRequest(input={"type": "text", "text": "evacuate ward 1"})
    turn_res = submit_turn(session_id, txt_turn)
    assert turn_res["status"] == "ok"
    assert turn_res["state"]["tick"] == 2
    assert turn_res["state"]["zones"]["ward-1"]["evacuation_ordered"] is True
    for ev in turn_res["events"]:
        assert "type" in ev
        assert "tick" in ev
        assert "caused_by" in ev

    # 4. Check After-Action Report and Log
    report = get_session_report(session_id)
    assert "score" in report
    assert 0 <= report["score"]["total_score"] <= 100

    log = get_session_log(session_id)
    assert len(log["events"]) > 0
    for ev in log["events"]:
        assert "type" in ev
        assert "tick" in ev
        assert "caused_by" in ev
        assert "zone" in ev or "target" in ev

    # 5. Check session state endpoint
    state_res = get_session_state(session_id)
    assert "layout" in state_res
    assert "summary" in state_res
    assert state_res["summary"]["zones"]["ward-1"]["population_remaining"] is not None


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


def test_openapi_contract_frozen_and_complete():
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    openapi_path = os.path.join(root, "docs", "openapi.json")
    with open(openapi_path, "r", encoding="utf-8") as f:
        frozen = json.load(f)

    live = app.openapi()
    assert frozen == live, "docs/openapi.json is out of sync with app.openapi()"

    paths = frozen["paths"]
    assert "/{full_path}" not in paths
    assert "/{full_path:path}" not in paths
    for path_key, methods in paths.items():
        if path_key.startswith("/api/v1/"):
            for op in methods.values():
                schema = op["responses"]["200"]["content"]["application/json"]["schema"]
                assert schema, f"Missing response schema on {path_key}"

    schemas = frozen["components"]["schemas"]
    assert "layout" in schemas["ScenarioSummary"]["properties"]
    assert "layout" in schemas["CreateSessionResponse"]["properties"]
    assert "layout" in schemas["SessionStateResponse"]["properties"]
    assert "layout" in schemas["TurnResponse"]["properties"]

    event_props = schemas["EventOut"]["properties"]
    for field in ("type", "tick", "zone", "target", "caused_by", "description", "details"):
        assert field in event_props

    turn_props = schemas["TurnResponse"]["properties"]
    for field in ("source", "guardrail", "llm_mode"):
        assert field in turn_props

    guardrail_props = schemas["GuardrailOut"]["properties"]
    for field in ("status", "retries", "fallback_reason"):
        assert field in guardrail_props

    meta_props = schemas["MetaResponse"]["properties"]
    for field in ("example_commands", "llm_mode", "llm_status"):
        assert field in meta_props

    health_props = schemas["HealthResponse"]["properties"]
    for field in ("llm_mode", "llm_status"):
        assert field in health_props


def test_api_clarify_emergency_halt_and_max_input_chars():
    async def _run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            sess_res = await client.post("/api/v1/sessions", json={"scenario_id": "village-river-01"})
            assert sess_res.status_code == 200
            sid = sess_res.json()["session_id"]

            # 1. Ambiguous clarify turn -> tick remains 0
            clarify_res = await client.post(
                f"/api/v1/sessions/{sid}/turns",
                json={"input": {"type": "text", "text": "evacuate"}},
            )
            assert clarify_res.status_code == 200
            cdata = clarify_res.json()
            assert cdata["status"] == "clarify"
            assert cdata["clarify"] is not None
            assert cdata["state"]["tick"] == 0
            assert cdata["source"] == "template"
            assert "llm_mode" in cdata
            assert "guardrail" in cdata

            # 2. 112 and 1078 real-emergency halts -> tick remains 0
            for emergency_phrase in ("call 112 for me", "call 1078 disaster helpline for me"):
                eres = await client.post(
                    f"/api/v1/sessions/{sid}/turns",
                    json={"input": {"type": "text", "text": emergency_phrase}},
                )
                assert eres.status_code == 200
                edata = eres.json()
                assert edata["status"] == "real_emergency"
                assert edata["source"] == "emergency_override"
                assert edata["guardrail"]["fallback_reason"] == "emergency_override"
                assert "112" in edata["narration"]["text"]
                assert "1078" in edata["narration"]["text"]
                assert edata["state"]["tick"] == 0

            # 3. MAX_INPUT_CHARS rejection on /turns and /npc/{id}/messages matches TurnResponse
            long_text = "x" * (MAX_INPUT_CHARS + 1)
            long_turn = await client.post(
                f"/api/v1/sessions/{sid}/turns",
                json={"input": {"type": "text", "text": long_text}},
            )
            assert long_turn.status_code == 200
            lt_data = long_turn.json()
            assert lt_data["status"] == "rejected"
            assert lt_data["source"] == "template"
            assert "llm_mode" in lt_data
            assert "layout" in lt_data and lt_data["layout"] is not None
            assert "summary" in lt_data and lt_data["summary"] is not None
            assert lt_data["state"]["tick"] == 0

            long_npc = await client.post(
                f"/api/v1/sessions/{sid}/npc/village_head/messages",
                json={"message": long_text},
            )
            assert long_npc.status_code == 200
            ln_data = long_npc.json()
            assert ln_data["status"] == "rejected"
            assert ln_data["source"] == "template"
            assert "llm_mode" in ln_data
            assert "layout" in ln_data and ln_data["layout"] is not None
            assert "summary" in ln_data and ln_data["summary"] is not None

            long_consult_btn = await client.post(
                f"/api/v1/sessions/{sid}/turns",
                json={
                    "input": {
                        "type": "button",
                        "action": {
                            "name": "consult_npc",
                            "params": {"npc_id": "village_head", "user_message": long_text},
                        },
                    }
                },
            )
            assert long_consult_btn.status_code == 200
            lcb_data = long_consult_btn.json()
            assert lcb_data["status"] == "rejected"
            assert lcb_data["source"] == "template"
            assert "llm_mode" in lcb_data
            assert "layout" in lcb_data and lcb_data["layout"] is not None
            assert "summary" in lcb_data and lcb_data["summary"] is not None
            assert lcb_data["state"]["tick"] == 0

            # 4. Real-emergency halt on /npc/{npc_id}/messages -> tick remains 0
            for npc_emergency in (
                "I am actually drowning call 112",
                "call 112 real emergency",
                "call 1078 disaster helpline for me",
            ):
                npc_eres = await client.post(
                    f"/api/v1/sessions/{sid}/npc/village_head/messages",
                    json={"message": npc_emergency},
                )
                assert npc_eres.status_code == 200
                nedata = npc_eres.json()
                assert nedata["status"] == "real_emergency"
                assert nedata["source"] == "emergency_override"
                assert nedata["guardrail"]["fallback_reason"] == "emergency_override"
                assert "112" in nedata["narration"]["text"]
                assert "1078" in nedata["narration"]["text"]
                assert nedata["state"]["tick"] == 0

            # 5. Null input payloads on /turns return 200 rejected (never 500)
            for null_payload in (
                {"input": {"type": "text", "text": None}},
                {"input": {"type": "button", "action": None}},
            ):
                null_res = await client.post(
                    f"/api/v1/sessions/{sid}/turns",
                    json=null_payload,
                )
                assert null_res.status_code == 200
                ndata = null_res.json()
                assert ndata["status"] == "rejected"
                assert ndata["state"]["tick"] == 0

    asyncio.run(_run())
