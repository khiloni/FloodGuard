"""Help ("What should I do?"), NPC suggestions and report additions."""
import json
import random

from fastapi.testclient import TestClient

from backend.app.engine.loader import load_scenario
from backend.app.engine.models import Action, ActionName
from backend.app.engine.rules import validate_action_preconditions
from backend.app.engine.step import step
from backend.app.main import app
from backend.app.services.advisor import suggest

from test_fake_llm_server import FakeLLM, fake_llm  # noqa: F401  (fixture)

client = TestClient(app)
BUTTON = lambda name, **p: {"input": {"type": "button", "action": {"name": name, "params": p}}}  # noqa: E731


def _session(pack="village-river-01", **kw):
    return client.post("/api/v1/sessions", json={"scenario_id": pack, **kw}).json()["session_id"]


def _help(sid):
    r = client.post(f"/api/v1/sessions/{sid}/help")
    assert r.status_code == 200, r.text
    return r.json()


def test_help_returns_two_or_three_valid_options_and_never_acts():
    for pack in ("village-river-01", "urban-flash-flood-01", "dam-release-01", "cyclone-surge-01"):
        sid = _session(pack)
        h = _help(sid)
        assert 2 <= len(h["options"]) <= 3
        assert h["source"] == "template" and "Nothing happens" in h["note"]
        state = load_scenario(f"scenarios/{pack}.yaml")
        names = [o["action"]["name"] for o in h["options"]]
        assert len(set(names)) == len(names)
        for o in h["options"]:
            act = Action(name=ActionName(o["action"]["name"]), params=o["action"]["params"])
            assert validate_action_preconditions(state, act)[0]
            assert o["tradeoff"] and o["rule_card"]["id"].startswith("RC-")
        # asking for help does not advance time or record an action
        assert client.get(f"/api/v1/sessions/{sid}/state").json()["state"]["tick"] == 0
        assert client.get(f"/api/v1/sessions/{sid}/log").json()["actions"] == []
        priorities = [o["priority"] for o in h["options"]]
        assert priorities == sorted(priorities, reverse=True)


def test_help_is_deterministic_and_recovery_aware():
    s = load_scenario("scenarios/village-river-01.yaml")
    assert suggest(s) == suggest(load_scenario("scenarios/village-river-01.yaml"))
    rng = random.Random(0)
    while s.phase != "recovery":
        s, _ = step(s, Action(name=ActionName.WAIT, params={}), rng)
    names = {o["action"]["name"] for o in suggest(s)}
    assert names & {"search_and_rescue", "provide_clean_water", "run_medical_camp"}
    assert not names & {"issue_warning", "order_evacuation", "reinforce_embankment"}


def test_help_phrased_by_llm_when_valid(fake_llm):
    sid = _session()
    lines = ["Opening the school gives 320 places for evacuees.",
             "A warning makes people more willing to leave.",
             "Ward 1 has 120 people on low ground."]
    fake_llm.replies = [json.dumps({"text": " ||| ".join(lines), "cited_cards": []})]
    h = _help(sid)
    assert h["source"] == "llm" and h["guardrail"]["status"] == "passed"
    assert [o["tradeoff"] for o in h["options"]] == lines
    assert [o["action"]["name"] for o in h["options"]] == [o["action"]["name"] for o in suggest(load_scenario("scenarios/village-river-01.yaml"))]


def test_help_falls_back_on_bad_llm_output(fake_llm):
    sid = _session()
    fake_llm.replies = [json.dumps({"text": "Everyone survived. ||| 9999 boats ||| ok", "cited_cards": []})]
    h = _help(sid)
    assert h["source"] == "template" and h["guardrail"]["status"] == "fallback"
    template = suggest(load_scenario("scenarios/village-river-01.yaml"))
    assert [o["tradeoff"] for o in h["options"]] == [o["tradeoff"] for o in template]


def test_help_works_when_llm_is_down(monkeypatch):
    monkeypatch.setenv("LLM_MODE", "openai_compat")
    monkeypatch.setenv("LLM_BASE_URL", "http://127.0.0.1:9/v1")
    from backend.app.llm.openai_compat import reset_circuit_breaker
    reset_circuit_breaker()
    try:
        h = _help(_session())
        assert h["source"] == "template" and len(h["options"]) >= 2
    finally:
        reset_circuit_breaker()


def test_npc_suggestion_is_offered_not_executed():
    sid = _session()
    res = client.post(f"/api/v1/sessions/{sid}/npc/district_official/messages", json={"message": "What can the district do?"}).json()
    msg = res["npc_messages"][0]
    assert msg["suggestion"]["action"]["name"] == "request_external_support"
    # only the consultation happened; the suggestion was not carried out
    log = client.get(f"/api/v1/sessions/{sid}/log").json()
    assert [a["name"] for a in log["actions"]] == ["consult_npc"]
    assert res["state"]["support_eta_tick"] is None


def test_new_npcs_answer_in_every_pack():
    for pack in ("village-river-01", "urban-flash-flood-01", "dam-release-01", "cyclone-surge-01"):
        sid = _session(pack)
        for npc in ("health_worker", "district_official"):
            r = client.post(f"/api/v1/sessions/{sid}/turns", json=BUTTON("consult_npc", npc_id=npc)).json()
            assert r["status"] == "ok" and r["npc_messages"][0]["text"]
            assert "Ward 1" not in r["npc_messages"][0]["text"] or pack == "village-river-01"


def test_report_links_rule_cards_and_retry_same_seed_is_identical():
    sid = _session("dam-release-01", seed=4242, difficulty="hard")
    plan = [BUTTON("open_shelter", shelter_id="hilltop-school"), BUTTON("request_staggered_release"),
            BUTTON("issue_warning"), BUTTON("request_external_support")]
    for p in plan:
        assert client.post(f"/api/v1/sessions/{sid}/turns", json=p).json()["status"] == "ok"
    rep = client.get(f"/api/v1/sessions/{sid}/report").json()
    assert rep["seed"] == 4242 and rep["difficulty"] == "hard" and rep["scenario_id"] == "dam-release-01"
    assert rep["rule_cards"] and all(c["id"].startswith("RC-") for c in rep["rule_cards"])
    assert any(l["rule_card_ids"] for l in rep["causal_chain"])
    # retry with the same seed, scenario and difficulty reproduces the same state
    sid2 = _session(rep["scenario_id"], seed=rep["seed"], difficulty=rep["difficulty"], language=rep["language"])
    for p in plan:
        last = client.post(f"/api/v1/sessions/{sid2}/turns", json=p).json()
    assert last["state"] == client.get(f"/api/v1/sessions/{sid}/state").json()["state"]
