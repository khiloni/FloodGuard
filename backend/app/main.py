import os
import uuid
import random
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from .engine.loader import load_scenario
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
                    scenarios.append({
                        "id": s.scenario_id,
                        "name": fname.replace(".yaml", "").replace("-", " ").title(),
                        "version": s.scenario_version,
                        "total_ticks": s.max_ticks,
                        "description": "Riverside village simulation with 3 wards, 1 shelter, and flood forecast curve.",
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

    store.create_session(
        session_id=session_id,
        scenario_id=req.scenario_id,
        seed=seed,
        difficulty=req.difficulty,
        language=req.language,
        initial_state_dict=initial_state.model_dump(),
    )

    return {
        "session_id": session_id,
        "seed": seed,
        "state": initial_state.model_dump(),
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
    return {
        "session_id": session_id,
        "state": sess["state"],
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
    result = process_turn(
        session_id=session_id,
        turn_input=req.input,
        store=store,
        validator=validator,
    )
    return result


@app.post("/api/v1/sessions/{session_id}/npc/{npc_id}/messages")
def consult_npc_chat(session_id: str, npc_id: str, req: NPCMessageRequest):
    sess = store.get_session(session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": f"Session '{session_id}' not found."},
        )
    
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
