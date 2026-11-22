import os
import uuid
import random
import time
from collections import defaultdict
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from .engine.loader import load_scenario, load_scenario_config
from .engine.models import State, Action, ActionName
from .engine.scoring import calculate_score
from .guardrail.validator import GuardrailValidator
from .services.turn_pipeline import process_turn
from .services.npc import generate_npc_message
from .store.sqlite import SessionStore

# Root directory configuration
APP_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(APP_DIR)
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
SCENARIOS_DIR = os.path.join(PROJECT_ROOT, "scenarios")
STATIC_DIR = os.path.join(PROJECT_ROOT, "frontend", "dist")
if not os.path.exists(STATIC_DIR):
    STATIC_DIR = os.path.join(BACKEND_DIR, "static")

# SQLite store
DB_PATH = os.path.join(BACKEND_DIR, "floodguard.db")
store = SessionStore(DB_PATH)

# Validator
validator = GuardrailValidator(allowed_names={
    "village-river-01", "ward-1", "ward-2", "ward-3", "school",
    "village_head", "rescue_worker", "family_member", "sarpanch", "ramesh", "sunita", "mohan"
})

MAX_INPUT_CHARS = int(os.environ.get("MAX_INPUT_CHARS", "400"))
RATE_LIMIT_PER_MIN = int(os.environ.get("RATE_LIMIT_PER_MIN", "30"))
_rate_limit_records: Dict[str, List[float]] = defaultdict(list)


def enforce_rate_limit(client_id: str):
    if RATE_LIMIT_PER_MIN <= 0:
        return
    now = time.time()
    window = 60.0
    records = [t for t in _rate_limit_records[client_id] if now - t < window]
    if len(records) >= RATE_LIMIT_PER_MIN:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "RATE_LIMITED", "message": f"Rate limit of {RATE_LIMIT_PER_MIN} turns per minute exceeded. Please wait a moment."}
        )
    records.append(now)
    _rate_limit_records[client_id] = records


EXAMPLE_COMMANDS = [
    "evacuate ward 1",
    "send 2 boats to ward 2",
    "reinforce embankment with 200 sandbags",
    "warn all wards",
    "open the school shelter",
    "prioritize vulnerable in ward 1",
    "talk to the village head",
    "wait",
]


def get_scenario_layout(scenario_id: str) -> Dict[str, Any]:
    fpath = os.path.join(SCENARIOS_DIR, f"{scenario_id}.yaml")
    if os.path.exists(fpath):
        cfg = load_scenario_config(fpath)
        return cfg.get("layout", {})
    return {}


def build_state_summary(state_dict: Dict[str, Any], layout: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    levels = (layout or {}).get("levels", {})
    zones = state_dict.get("zones", {})
    shelters = state_dict.get("shelters", {})
    resources = state_dict.get("resources", {})
    embankment = state_dict.get("embankment", {})

    total_boats = resources.get("total_boats", 0)
    avail_boats = resources.get("available_boats", 0)
    boats_in_use = total_boats - avail_boats

    total_vehicles = resources.get("total_vehicles", 0)
    avail_vehicles = resources.get("available_vehicles", 0)
    vehicles_in_use = total_vehicles - avail_vehicles

    shelter_occupancy = sum(s.get("current_occupancy", 0) for s in shelters.values())
    shelter_capacity = sum(s.get("capacity", 0) for s in shelters.values())

    zones_summary = {}
    for zid, z in zones.items():
        zones_summary[zid] = {
            "name": z.get("name"),
            "population_remaining": z.get("population_remaining"),
            "safe_evacuated": z.get("safe_evacuated"),
            "in_transit": z.get("in_transit", 0),
            "vulnerable_remaining": z.get("vulnerable_remaining"),
            "vulnerable_saved": z.get("vulnerable_saved"),
            "water_depth_cm": z.get("water_depth_cm"),
            "road_flooded": z.get("road_flooded"),
            "evacuation_ordered": z.get("evacuation_ordered"),
            "warning_level": z.get("warning_level"),
            "boats_assigned": z.get("boats_assigned"),
            "vehicles_assigned": z.get("vehicles_assigned"),
        }

    return {
        "water_level_cm": state_dict.get("water_level_cm"),
        "normal_level_cm": levels.get("normal_level_cm", 200),
        "warning_level_cm": levels.get("warning_level_cm", 300),
        "danger_level_cm": levels.get("danger_level_cm", 380),
        "crest_level_cm": levels.get("crest_level_cm", 475),
        "embankment_integrity": embankment.get("integrity", 100),
        "embankment_height_cm": embankment.get("height_cm", 380),
        "embankment_breached": embankment.get("breached", False),
        "shelter": {
            "occupancy": shelter_occupancy,
            "capacity": shelter_capacity,
            "is_open": any(s.get("is_open", False) for s in shelters.values()),
        },
        "transport": {
            "boats_total": total_boats,
            "boats_available": avail_boats,
            "boats_in_use": boats_in_use,
            "vehicles_total": total_vehicles,
            "vehicles_available": avail_vehicles,
            "vehicles_in_use": vehicles_in_use,
        },
        "zones": zones_summary,
    }

app = FastAPI(
    title="FloodGuard API",
    version="1.0.0",
    description="Educational Flood-Response Simulation Engine API",
)

# CORS Middleware
allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DISCLAIMER_FULL_TEXT = (
    "This is an educational simulation, not emergency guidance. "
    "FloodGuard is a simplified teaching game. Its water levels, outcomes and scores are invented "
    "and are not a flood forecast or a real-world plan. Characters are fictional and AI-generated "
    "text can be wrong. If you are in a real emergency or a flood is happening near you, stop "
    "playing and call 112 (India emergency number). Follow instructions from your local authorities "
    "and official sources for your area (for example the India Meteorological Department, the Central "
    "Water Commission and your State Disaster Management Authority). Do not rely on this game for decisions "
    "about evacuation, safety or health."
)


# Request/Response Schemas
class CreateSessionRequest(BaseModel):
    scenario_id: str = "village-river-01"
    difficulty: str = "standard"
    language: str = "en"
    seed: Optional[int] = None


class TurnRequest(BaseModel):
    input: Dict[str, Any]


class NPCMessageRequest(BaseModel):
    message: str = ""


# API Endpoints under /api/v1
@app.get("/api/v1/health")
def get_health():
    return {
        "status": "ok",
        "llm_mode": os.environ.get("LLM_MODE", "template"),
        "db": "connected",
        "version": "1.0.0",
    }


@app.get("/api/v1/meta")
def get_meta():
    return {
        "version": "1.0.0",
        "disclaimer": DISCLAIMER_FULL_TEXT,
        "emergency_helpline": "112",
        "disaster_helpline": "1078",
        "supported_languages": ["en"],
        "llm_mode": os.environ.get("LLM_MODE", "template"),
        "example_commands": EXAMPLE_COMMANDS,
    }


@app.get("/api/v1/scenarios")
def list_scenarios():
    scenarios = []
    if os.path.exists(SCENARIOS_DIR):
        for fname in os.listdir(SCENARIOS_DIR):
            if fname.endswith(".yaml") or fname.endswith(".yml"):
                fpath = os.path.join(SCENARIOS_DIR, fname)
                try:
                    s = load_scenario(fpath)
                    cfg = load_scenario_config(fpath)
                    scenarios.append({
                        "id": s.scenario_id,
                        "name": cfg.get("name", fname.replace(".yaml", "").replace("-", " ").title()),
                        "version": s.scenario_version,
                        "total_ticks": s.max_ticks,
                        "description": cfg.get("description", "Riverside village simulation with 3 wards, 1 shelter, and flood forecast curve."),
                        "layout": cfg.get("layout", {}),
                    })
                except Exception:
                    pass
    return {"scenarios": scenarios}


@app.post("/api/v1/sessions")
def create_session(req: CreateSessionRequest):
    scenario_file = os.path.join(SCENARIOS_DIR, f"{req.scenario_id}.yaml")
    if not os.path.exists(scenario_file):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SCENARIO_NOT_FOUND", "message": f"Scenario '{req.scenario_id}' not found."},
        )

    seed = req.seed if req.seed is not None else random.randint(1000, 999999)
    initial_state = load_scenario(scenario_file)
    session_id = str(uuid.uuid4())
    layout = get_scenario_layout(req.scenario_id)
    state_dict = initial_state.model_dump()
    summary = build_state_summary(state_dict, layout)

    store.create_session(
        session_id=session_id,
        scenario_id=req.scenario_id,
        seed=seed,
        difficulty=req.difficulty,
        language=req.language,
        initial_state_dict=state_dict,
    )

    return {
        "session_id": session_id,
        "seed": seed,
        "state": state_dict,
        "layout": layout,
        "summary": summary,
        "disclaimer": DISCLAIMER_FULL_TEXT,
    }


@app.get("/api/v1/sessions/{session_id}/state")
def get_session_state(session_id: str):
    sess = store.get_session(session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": f"Session '{session_id}' not found."},
        )
    layout = get_scenario_layout(sess["scenario_id"])
    summary = build_state_summary(sess["state"], layout)
    return {
        "session_id": session_id,
        "state": sess["state"],
        "layout": layout,
        "summary": summary,
        "is_ended": sess["is_ended"],
    }


@app.post("/api/v1/sessions/{session_id}/turns")
def submit_turn(session_id: str, req: TurnRequest):
    sess = store.get_session(session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": f"Session '{session_id}' not found."},
        )

    # Input length cap
    if req.input.get("type") == "text":
        user_text = req.input.get("text", "")
        if len(user_text) > MAX_INPUT_CHARS:
            return {
                "status": "rejected",
                "parsed_action": None,
                "clarify": None,
                "reject_reason": f"Input text exceeds maximum limit of {MAX_INPUT_CHARS} characters.",
                "state": sess["state"],
                "events": [],
                "narration": {"text": f"Input exceeded limit of {MAX_INPUT_CHARS} characters.", "source": "template"},
                "npc_messages": [],
                "guardrail": {"status": "passed", "retries": 0},
                "disclaimer": DISCLAIMER_FULL_TEXT,
            }

    enforce_rate_limit(session_id)

    result = process_turn(
        session_id=session_id,
        turn_input=req.input,
        store=store,
        validator=validator,
    )
    if result.get("state"):
        layout = get_scenario_layout(sess["scenario_id"])
        result["layout"] = layout
        result["summary"] = build_state_summary(result["state"], layout)
    return result


@app.post("/api/v1/sessions/{session_id}/npc/{npc_id}/messages")
def consult_npc_chat(session_id: str, npc_id: str, req: NPCMessageRequest):
    sess = store.get_session(session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": f"Session '{session_id}' not found."},
        )

    # Input length cap
    if len(req.message) > MAX_INPUT_CHARS:
        return {
            "status": "rejected",
            "parsed_action": None,
            "clarify": None,
            "reject_reason": f"Message exceeds maximum limit of {MAX_INPUT_CHARS} characters.",
            "state": sess["state"],
            "events": [],
            "narration": {"text": f"Message exceeded limit of {MAX_INPUT_CHARS} characters.", "source": "template"},
            "npc_messages": [],
            "guardrail": {"status": "passed", "retries": 0},
            "disclaimer": DISCLAIMER_FULL_TEXT,
        }

    enforce_rate_limit(session_id)
    
    turn_input = {
        "type": "button",
        "action": {
            "name": "consult_npc",
            "params": {"npc_id": npc_id, "user_message": req.message},
        },
    }
    result = process_turn(
        session_id=session_id,
        turn_input=turn_input,
        store=store,
        validator=validator,
    )
    if result.get("state"):
        layout = get_scenario_layout(sess["scenario_id"])
        result["layout"] = layout
        result["summary"] = build_state_summary(result["state"], layout)
    return result


@app.get("/api/v1/sessions/{session_id}/log")
def get_session_log(session_id: str):
    sess = store.get_session(session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": f"Session '{session_id}' not found."},
        )
    events = store.get_events(session_id)
    return {
        "session_id": session_id,
        "scenario_id": sess["scenario_id"],
        "seed": sess["seed"],
        "actions": sess["actions"],
        "events": events,
    }


@app.get("/api/v1/sessions/{session_id}/report")
def get_session_report(session_id: str):
    sess = store.get_session(session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": f"Session '{session_id}' not found."},
        )
    
    state = State.model_validate(sess["state"])
    score = state.score
    if not score:
        score = calculate_score(state)

    events = store.get_events(session_id)
    return {
        "session_id": session_id,
        "score": score.model_dump(),
        "final_state": state.model_dump(),
        "events": events,
        "disclaimer": DISCLAIMER_FULL_TEXT,
    }


@app.post("/api/v1/sessions/{session_id}/end")
def end_session(session_id: str):
    sess = store.get_session(session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": f"Session '{session_id}' not found."},
        )
    
    state = State.model_validate(sess["state"])
    final_score = calculate_score(state)
    new_state = state.model_copy(update={"is_finished": True, "score": final_score})
    store.update_session(
        session_id=session_id,
        actions=sess["actions"],
        state_dict=new_state.model_dump(),
        is_ended=True,
    )
    return {
        "status": "ended",
        "score": final_score.model_dump(),
    }


# Static Frontend Serving
if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
