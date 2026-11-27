"""Collect every English text the API can send, by playing every story many ways.

    python -m backend.scripts.harvest_text [out.json]

Used to build and check the translation catalogue (backend/app/i18n): plays expert, idle and
random runs of each scenario pack through the real API (template mode), asks for help and talks to
every character on the way, tries every order each turn to collect the rejection reasons, and
records narration, character replies, rejections, clarify questions, help options, event
descriptions and report text. Returns a sorted list of unique strings.
"""
import json
import os
import random
import sys
import tempfile

os.environ["LLM_MODE"] = "template"
os.environ["RATE_LIMIT_PER_MIN"] = "0"
os.environ.setdefault("FLOODGUARD_DB_PATH", os.path.join(tempfile.mkdtemp(), "harvest.db"))

from fastapi.testclient import TestClient  # noqa: E402

from backend.app.main import app  # noqa: E402

client = TestClient(app)

TEXTS = ["warn everyone", "evacuate", "do something useful", "send boats", "help", "open the shelter",
         "reinforce the embankment", "restore power", "clean water", "medical camp", "return residents",
         "clear the road", "survey damage", "search and rescue", "send supplies", "request support",
         "recall the fishing boats", "clear the drains", "ask the dam to release slowly", "wait"]


def actions_for(scn):
    zones = [z["id"] for z in scn["layout"]["zones"]]
    shelters = [s["id"] for s in scn["shelters"]]
    acts = [("issue_warning", {}), ("wait", {}), ("distribute_supplies", {}), ("provide_clean_water", {}),
            ("run_medical_camp", {}), ("restore_power", {}), ("request_external_support", {}),
            ("reinforce_embankment", {"sandbags": 100}), ("reinforce_embankment", {"sandbags": 5000}),
            ("recall_fishing_boats", {}), ("request_staggered_release", {})]
    for sh in shelters:
        acts.append(("open_shelter", {"shelter_id": sh}))
    for z in zones:
        acts += [("order_evacuation", {"zone": z}), ("prioritize_vulnerable", {"zone": z}),
                 ("assign_transport", {"zone": z, "transport_type": "boat", "count": 1}),
                 ("assign_transport", {"zone": z, "transport_type": "vehicle", "count": 2}),
                 ("assign_transport", {"zone": z, "transport_type": "boat", "count": 99}),
                 ("search_and_rescue", {"zone": z}), ("clear_roads", {"zone": z}),
                 ("damage_survey", {"zone": z}), ("return_residents", {"zone": z}), ("clear_drains", {"zone": z})]
    return acts


def collect_turn(res, out):
    if res.get("narration"):
        out.add(res["narration"]["text"])
    for m in res.get("npc_messages") or []:
        out.add(m["text"])
    if res.get("reject_reason"):
        out.add(res["reject_reason"])
    if res.get("clarify"):
        out.add(res["clarify"]["question"])
    for e in res.get("events") or []:
        out.add(e["description"])


def play(scn, seed, policy, out, rng):
    sid = client.post("/api/v1/sessions", json={"scenario_id": scn["id"], "seed": seed}).json()["session_id"]
    acts = actions_for(scn)
    npcs = [n["id"] for n in scn["npcs"]]
    for turn in range(60):
        # side channels that do not advance time
        if turn % 3 == 0:
            h = client.post(f"/api/v1/sessions/{sid}/help").json()
            for o in h.get("options", []):
                out.add(o.get("tradeoff", ""))
                out.add(o.get("text", "") or "")
            if h.get("message"):
                out.add(h["message"])
        if turn % 4 == 0:
            n = rng.choice(npcs)
            collect_turn(client.post(f"/api/v1/sessions/{sid}/npc/{n}/messages", json={"message": "What should we do?"}).json(), out)
        if turn % 5 == 0:
            collect_turn(client.post(f"/api/v1/sessions/{sid}/turns", json={"input": {"type": "text", "text": rng.choice(TEXTS)}}).json(), out)
        # probe a few orders for rejection reasons (rejections do not advance time)
        for name, params in rng.sample(acts, 6):
            r = client.post(f"/api/v1/sessions/{sid}/turns", json={"input": {"type": "button", "action": {"name": name, "params": params}}}).json()
            collect_turn(r, out)
            if r["status"] == "ok":
                break
        else:
            name, params = policy(turn, acts, rng)
            r = client.post(f"/api/v1/sessions/{sid}/turns", json={"input": {"type": "button", "action": {"name": name, "params": params}}}).json()
            collect_turn(r, out)
        st = client.get(f"/api/v1/sessions/{sid}/state").json()
        if st.get("state", {}).get("is_finished") or st.get("is_finished"):
            break
    rep = client.get(f"/api/v1/sessions/{sid}/report").json()
    for p in rep.get("phases", []):
        out.add(p["label"])
        for k in p.get("key_events", []):
            out.add(k.get("description") or "")
    for c in rep.get("causal_chain", []):
        out.add(c["explanation"])
        out.add(c["cause"].get("description") or "")
        out.add(c["effect"].get("description") or "")
    for e in rep.get("events", []):
        out.add(e.get("description") or "")


def harvest(seeds=6):
    out = set()
    scns = client.get("/api/v1/scenarios").json()["scenarios"]
    for scn in scns:
        for seed in range(seeds):
            rng = random.Random(seed * 7 + len(scn["id"]))
            policy = (lambda t, a, r: ("wait", {})) if seed % 3 == 0 else (lambda t, a, r: r.choice(a))
            play(scn, seed, policy, out, rng)
    out.discard("")
    return sorted(out)


if __name__ == "__main__":
    texts = harvest()
    path = sys.argv[1] if len(sys.argv) > 1 else None
    if path:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(texts, f, indent=1, ensure_ascii=False)
    print(len(texts), "unique strings")
