"""Record real API responses as MSW fixtures for `npm run dev:mock` and Playwright.

    python -m backend.scripts.record_fixtures

Runs the real FastAPI app in-process (template mode, temp DB) through scripted sessions and
writes JSON into frontend/src/mocks/fixtures/. Re-run whenever the API or scenario changes.
"""
import json
import os
import sys
import tempfile

os.environ["LLM_MODE"] = "template"
os.environ["RATE_LIMIT_PER_MIN"] = "0"
os.environ.setdefault("FLOODGUARD_DB_PATH", os.path.join(tempfile.mkdtemp(), "fixtures.db"))

from fastapi.testclient import TestClient  # noqa: E402

from backend.app.engine.models import EventType  # noqa: E402
from backend.app.main import app  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "frontend", "src", "mocks", "fixtures")

client = TestClient(app)


def B(name, **params):
    return {"type": "button", "action": {"name": name, "params": params}}


def T(text):
    return {"type": "text", "text": text}


EXPERT = {
    1: B("open_shelter", shelter_id="school"), 2: T("warn all wards"), 3: T("evacuate ward 1"),
    4: B("prioritize_vulnerable", zone="ward-1"), 5: T("send 2 boats to ward 1"),
    6: B("assign_transport", zone="ward-2", transport_type="vehicle", count=2),
    7: T("reinforce embankment with 200 sandbags"), 8: B("reinforce_embankment", sandbags=200),
    9: T("evacuate ward 2"), 10: B("consult_npc", npc_id="rescue_worker", user_message="How are the boats doing?"),
    11: B("order_evacuation", zone="ward-3"), 12: T("send relief supplies"), 15: B("distribute_supplies"),
    18: T("provide clean drinking water"), 19: T("set up a medical camp"), 20: T("survey damage in ward 2"),
    21: T("clear the road to ward 2"), 22: T("restore power"), 23: T("send ward 2 residents back home"),
    24: T("clear the road to ward 1"), 25: T("survey damage in ward 1"), 26: T("send ward 1 residents back home"),
    27: T("send ward 1 residents back home"), 28: T("return ward 3 residents"), 29: T("send ward 2 residents back home"),
}

NEGLECT = {
    1: B("open_shelter", shelter_id="school"), 9: B("consult_npc", npc_id="family_member", user_message="Are you safe?"),
    18: B("search_and_rescue", zone="ward-1"), 19: B("search_and_rescue", zone="ward-2"),
    23: B("run_medical_camp"), 24: B("search_and_rescue", zone="ward-1"),
}


def slim(resp):
    """Turn responses repeat the static layout; the frontend takes it from the session."""
    resp = dict(resp)
    resp.pop("layout", None)
    return resp


def new_session(seed):
    return client.post("/api/v1/sessions", json={"scenario_id": "village-river-01", "seed": seed}).json()


def play(plan, seed):
    sess = new_session(seed)
    sid = sess["session_id"]
    script, tick = [], 0
    while True:
        inp = plan.get(tick + 1, B("wait"))
        res = client.post(f"/api/v1/sessions/{sid}/turns", json={"input": inp}).json()
        if res["status"] != "ok":
            raise SystemExit(f"tick {tick + 1}: {inp} -> {res['status']} {res.get('reject_reason') or res.get('clarify')}")
        script.append({"input": inp, "response": slim(res)})
        tick = res["state"]["tick"]
        if res["state"]["is_finished"]:
            break
    return sess, script


def write(name, data):
    with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write("\n")


def main():
    os.makedirs(OUT, exist_ok=True)
    write("health.json", client.get("/api/v1/health").json())
    write("meta.json", client.get("/api/v1/meta").json())
    write("scenarios.json", client.get("/api/v1/scenarios").json())

    sess, script = play(EXPERT, seed=2026)
    sid = sess["session_id"]
    write("session.json", sess)
    write("script.json", script)
    write("log.json", client.get(f"/api/v1/sessions/{sid}/log", params={"frames": "true"}).json())
    write("report.json", client.get(f"/api/v1/sessions/{sid}/report").json())

    # Single-turn responses on a fresh session (none of these advance time)
    side = new_session(7)["session_id"]
    write("clarify.json", slim(client.post(f"/api/v1/sessions/{side}/turns", json={"input": T("do something useful")}).json()))
    write("rejected.json", slim(client.post(f"/api/v1/sessions/{side}/turns", json={"input": T("restore power")}).json()))
    write("emergency.json", slim(client.post(f"/api/v1/sessions/{side}/turns",
                                             json={"input": T("this is a real emergency, I am actually trapped")}).json()))

    # One real event of every type, for the per-event animation tests
    _, neglect = play(NEGLECT, seed=99)
    first_of = {}
    for step_ in script + neglect:
        for ev in step_["response"]["events"]:
            first_of.setdefault(ev["type"], ev)
    missing = [t.value for t in EventType if t.value not in first_of]
    if missing:
        raise SystemExit(f"fixtures do not cover event types: {missing}")
    all_events = dict(script[0]["response"])
    all_events["events"] = [first_of[t.value] for t in EventType]
    all_events["narration"] = {"text": "Animation test: one event of every type.", "source": "template"}
    write("all_events.json", all_events)
    print(f"wrote fixtures to {OUT}: {len(script)} expert turns, {len(first_of)} event types")


if __name__ == "__main__":
    sys.exit(main())
