import logging
import os
import uuid
import random
import time
from collections import defaultdict
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ConfigDict

from .engine.loader import load_scenario, load_scenario_config
from .engine.models import State, Action, ActionName, ScoreBreakdown
from .engine.scoring import calculate_score
from .guardrail.validator import GuardrailValidator
from .llm.openai_compat import get_llm_mode, get_llm_status
from .llm import providers as llm_providers
from .services.turn_pipeline import process_turn
from .services.report import build_report_sections
from .store.sqlite import SessionStore

logger = logging.getLogger("floodguard.api")

# Root directory configuration
APP_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(APP_DIR)
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
SCENARIOS_DIR = os.path.join(PROJECT_ROOT, "scenarios")
STATIC_DIR = os.path.join(PROJECT_ROOT, "frontend", "dist")
if not os.path.exists(STATIC_DIR):
    STATIC_DIR = os.path.join(BACKEND_DIR, "static")

# SQLite store
DB_PATH = os.environ.get("FLOODGUARD_DB_PATH") or os.path.join(BACKEND_DIR, "floodguard.db")
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
    "send relief supplies to the shelter",
    "provide clean drinking water",
    "set up a medical camp",
    "search and rescue in ward 1",
    "clear the road to ward 1",
    "survey damage in ward 1",
    "restore power",
    "send ward 2 residents back home",
]

EXAMPLE_COMMANDS_BY_PHASE = {
    "before": ["warn all wards", "open the school shelter", "evacuate ward 1", "prioritize vulnerable in ward 1"],
    "flood": ["send 2 boats to ward 1", "reinforce embankment with 200 sandbags", "evacuate ward 2",
              "send relief supplies to the shelter", "talk to the rescue worker"],
    "recovery": ["provide clean drinking water", "set up a medical camp", "search and rescue in ward 1",
                 "clear the road to ward 1", "survey damage in ward 1", "restore power",
                 "send ward 2 residents back home", "send relief supplies to the shelter"],
}

API_VERSION = "2.1.0"
SUPPORTED_LANGUAGES = ["en", "hi"]


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
            "max_depth_cm": z.get("max_depth_cm", 0),
            "returned": z.get("returned", 0),
            "in_shelter": z.get("safe_evacuated", 0) - z.get("returned", 0),
            "road_blocked": z.get("road_blocked", False),
            "surveyed": z.get("surveyed", False),
        }

    rec = state_dict.get("recovery") or {}
    return {
        "tick": state_dict.get("tick", 0),
        "max_ticks": state_dict.get("max_ticks", 0),
        "phase": state_dict.get("phase", "before"),
        "flood_start_tick": state_dict.get("flood_start_tick"),
        "recovery_start_tick": state_dict.get("recovery_start_tick"),
        "displaced": shelter_occupancy,
        "recovery": {
            "shelter_supplies": rec.get("shelter_supplies", 0),
            "supply_deliveries_left": rec.get("supply_deliveries_left", 0),
            "clean_water_active": rec.get("clean_water_active", False),
            "clean_water_kits": rec.get("clean_water_kits", 0),
            "medical_camp_active": rec.get("medical_camp_active", False),
            "medical_teams": rec.get("medical_teams", 0),
            "disease_risk": rec.get("disease_risk", 0),
            "peak_disease_risk": rec.get("peak_disease_risk", 0),
            "illness_cases": rec.get("illness_cases", 0),
            "illness_untreated": rec.get("illness_cases", 0) - rec.get("illness_treated", 0),
            "power_on": rec.get("power_on", True),
            "health_centre_open": rec.get("health_centre_open", True),
            "community_trust": rec.get("community_trust", 0),
        },
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
    version=API_VERSION,
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


class HealthResponse(BaseModel):
    status: str
    llm_mode: str
    llm_status: str
    llm_provider: str = "ollama"
    db: str
    version: str


class MetaResponse(BaseModel):
    version: str
    disclaimer: str
    emergency_helpline: str
    disaster_helpline: str
    supported_languages: List[str]
    llm_mode: str
    llm_status: str
    llm_provider: str = "ollama"
    llm_model: str = ""
    llm_model_license: str = ""
    example_commands: List[str]
    example_commands_by_phase: Dict[str, List[str]] = Field(default_factory=dict)


class CanvasModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    width: int = 1000
    height: int = 600


class LevelsModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    normal_level_cm: int = 200
    warning_level_cm: int = 300
    danger_level_cm: int = 380
    crest_level_cm: int = 475


class RiverModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: Optional[str] = None
    flow_direction: Optional[str] = None
    center_path: List[List[int]] = Field(default_factory=list)
    north_bank: List[List[int]] = Field(default_factory=list)
    south_bank: List[List[int]] = Field(default_factory=list)


class EmbankmentSegmentModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    start: List[int] = Field(default_factory=list)
    end: List[int] = Field(default_factory=list)
    label: Optional[str] = None


class EmbankmentLayoutModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: Optional[str] = None
    crest_height_cm: Optional[int] = None
    segments: List[EmbankmentSegmentModel] = Field(default_factory=list)


class ZoneLayoutModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    x: int
    y: int
    width: int
    height: int
    elevation_cm: int
    house_points: List[List[int]] = Field(default_factory=list)


class ShelterLayoutModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    x: int
    y: int
    width: int
    height: int
    elevation_cm: int


class RouteLayoutModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    zone_id: str
    shelter_id: str
    transport_modes: List[str] = Field(default_factory=list)
    road_cutoff_depth_cm: Optional[int] = None
    waypoints: List[List[int]] = Field(default_factory=list)


class RecoverySiteModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    x: int
    y: int
    label: Optional[str] = None


class DecorModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    trees: List[List[int]] = Field(default_factory=list)
    jetty: Optional[Dict[str, Any]] = None
    bridges: List[Dict[str, Any]] = Field(default_factory=list)
    hills: List[List[int]] = Field(default_factory=list)


class LayoutModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    canvas: Optional[CanvasModel] = None
    levels: Optional[LevelsModel] = None
    river: Optional[RiverModel] = None
    embankment: Optional[EmbankmentLayoutModel] = None
    zones: List[ZoneLayoutModel] = Field(default_factory=list)
    shelters: List[ShelterLayoutModel] = Field(default_factory=list)
    routes: List[RouteLayoutModel] = Field(default_factory=list)
    decor: Optional[DecorModel] = None
    recovery_sites: Dict[str, RecoverySiteModel] = Field(default_factory=dict)


class NpcInfo(BaseModel):
    id: str
    name: str
    role: str
    location: Optional[str] = None
    initial_dialogue: Optional[str] = None


class ShelterInfo(BaseModel):
    id: str
    name: str
    capacity: int


class ScenarioSummary(BaseModel):
    id: str
    name: str
    version: str
    total_ticks: int
    description: str
    layout: LayoutModel
    hazard_type: str = "river_flood"
    hazard_label: str = "River flood"
    difficulty_label: str = "Moderate"
    hook: str = ""
    illustration: str = "river"
    tick_duration_minutes: int = 30
    languages: List[str] = Field(default_factory=lambda: ["en"])
    difficulties: List[str] = Field(default_factory=lambda: ["easy", "standard", "hard"])
    mechanic_type: str = "none"
    external_support: Optional[Dict[str, int]] = None
    npcs: List[NpcInfo] = Field(default_factory=list)
    shelters: List[ShelterInfo] = Field(default_factory=list)


class ScenariosListResponse(BaseModel):
    scenarios: List[ScenarioSummary]


class ShelterSummary(BaseModel):
    occupancy: int
    capacity: int
    is_open: bool


class TransportSummary(BaseModel):
    boats_total: int
    boats_available: int
    boats_in_use: int
    vehicles_total: int
    vehicles_available: int
    vehicles_in_use: int


class ZoneSummary(BaseModel):
    name: Optional[str] = None
    population_remaining: int
    safe_evacuated: int
    in_transit: int
    vulnerable_remaining: int
    vulnerable_saved: int
    water_depth_cm: int
    road_flooded: bool
    evacuation_ordered: bool
    warning_level: int
    boats_assigned: int
    vehicles_assigned: int
    max_depth_cm: int = 0
    returned: int = 0
    in_shelter: int = 0
    road_blocked: bool = False
    surveyed: bool = False


class RecoverySummary(BaseModel):
    shelter_supplies: int
    supply_deliveries_left: int
    clean_water_active: bool
    clean_water_kits: int
    medical_camp_active: bool
    medical_teams: int
    disease_risk: int
    peak_disease_risk: int
    illness_cases: int
    illness_untreated: int
    power_on: bool
    health_centre_open: bool
    community_trust: int


class StateSummary(BaseModel):
    tick: int = 0
    max_ticks: int = 0
    phase: str = "before"
    flood_start_tick: Optional[int] = None
    recovery_start_tick: Optional[int] = None
    displaced: int = 0
    recovery: Optional[RecoverySummary] = None
    water_level_cm: int
    normal_level_cm: int
    warning_level_cm: int
    danger_level_cm: int
    crest_level_cm: int
    embankment_integrity: int
    embankment_height_cm: int
    embankment_breached: bool
    shelter: ShelterSummary
    transport: TransportSummary
    zones: Dict[str, ZoneSummary]


class CreateSessionResponse(BaseModel):
    session_id: str
    seed: int
    state: State
    layout: LayoutModel
    summary: StateSummary
    disclaimer: str


class SessionStateResponse(BaseModel):
    session_id: str
    state: State
    layout: LayoutModel
    summary: StateSummary
    is_ended: bool


class EventOut(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: str
    tick: int
    zone: Optional[str] = None
    target: Optional[str] = None
    caused_by: str
    description: str
    details: Dict[str, Any] = Field(default_factory=dict)
    event_type: Optional[str] = None


class NarrationOut(BaseModel):
    text: str
    source: str


class NPCMessageOut(BaseModel):
    npc_id: str
    text: str
    source: str


class ClarifyOut(BaseModel):
    question: str
    options: List[Action]


class GuardrailOut(BaseModel):
    status: str
    retries: int
    fallback_reason: Optional[str] = None


class RuleCardOut(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    title: str
    category: str
    guidance: str
    keywords: List[str] = Field(default_factory=list)
    source_reference: str


class TurnResponse(BaseModel):
    status: str
    parsed_action: Optional[Action] = None
    clarify: Optional[ClarifyOut] = None
    reject_reason: Optional[str] = None
    state: Optional[State] = None
    layout: Optional[LayoutModel] = None
    summary: Optional[StateSummary] = None
    events: List[EventOut] = Field(default_factory=list)
    narration: NarrationOut
    npc_messages: List[NPCMessageOut] = Field(default_factory=list)
    guardrail: GuardrailOut
    source: str = "template"
    llm_mode: str = "template"
    disclaimer: str
    cited_rulecards: List[RuleCardOut] = Field(default_factory=list)


class NPCMessageResponse(TurnResponse):
    pass


class ReplayFrameOut(BaseModel):
    tick: int
    phase: str
    action: Optional[Action] = None
    summary: StateSummary


class SessionLogResponse(BaseModel):
    session_id: str
    scenario_id: str
    seed: int
    actions: List[Action]
    events: List[EventOut]
    frames: Optional[List[ReplayFrameOut]] = None


class CauseEffectOut(BaseModel):
    tick: Optional[int] = None
    type: str
    zone: Optional[str] = None
    description: Optional[str] = None


class CausalLinkOut(BaseModel):
    phase: str
    cause: CauseEffectOut
    effect: CauseEffectOut
    explanation: str


class ReportPhaseOut(BaseModel):
    phase: str
    label: str
    reached: bool
    start_tick: Optional[int] = None
    end_tick: Optional[int] = None
    key_events: List[CauseEffectOut] = Field(default_factory=list)
    score_components: Dict[str, int] = Field(default_factory=dict)
    score_points: int
    score_max: int


class SessionReportResponse(BaseModel):
    session_id: str
    score: ScoreBreakdown
    final_state: State
    events: List[EventOut]
    phases: List[ReportPhaseOut] = Field(default_factory=list)
    causal_chain: List[CausalLinkOut] = Field(default_factory=list)
    disclaimer: str


class EndSessionResponse(BaseModel):
    status: str
    score: ScoreBreakdown


# API Endpoints under /api/v1
@app.get("/api/v1/health", response_model=HealthResponse)
def get_health():
    return {
        "status": "ok",
        "llm_mode": get_llm_mode(),
        "llm_status": get_llm_status(),
        "llm_provider": llm_providers.provider_name(),
        "db": "connected",
        "version": API_VERSION,
    }


@app.get("/api/v1/meta", response_model=MetaResponse)
def get_meta():
    return {
        "version": API_VERSION,
        "disclaimer": DISCLAIMER_FULL_TEXT,
        "emergency_helpline": "112",
        "disaster_helpline": "1078",
        "supported_languages": SUPPORTED_LANGUAGES,
        "llm_mode": get_llm_mode(),
        "llm_status": get_llm_status(),
        "llm_provider": llm_providers.provider_name(),
        "llm_model": llm_providers.model(),
        "llm_model_license": llm_providers.model_license(),
        "example_commands": EXAMPLE_COMMANDS,
        "example_commands_by_phase": EXAMPLE_COMMANDS_BY_PHASE,
    }


@app.get("/api/v1/scenarios", response_model=ScenariosListResponse)
def list_scenarios():
    scenarios = []
    if os.path.exists(SCENARIOS_DIR):
        files = sorted(f for f in os.listdir(SCENARIOS_DIR) if f.endswith((".yaml", ".yml")))
        # The original river village first, then the other packs alphabetically.
        files.sort(key=lambda f: (not f.startswith("village-river"), f))
        for fname in files:
            fpath = os.path.join(SCENARIOS_DIR, fname)
            try:
                s = load_scenario(fpath)
                cfg = load_scenario_config(fpath)
            except Exception as exc:  # a broken pack must not take the whole list down
                logger.warning("scenario %s failed to load: %s", fname, exc)
                continue
            sup = cfg.get("external_support") or None
            scenarios.append({
                "id": s.scenario_id,
                "name": cfg.get("name", fname.replace(".yaml", "").replace("-", " ").title()),
                "version": s.scenario_version,
                "total_ticks": s.max_ticks,
                "description": cfg.get("description", ""),
                "layout": cfg.get("layout", {}),
                "hazard_type": cfg.get("hazard_type", "river_flood"),
                "hazard_label": cfg.get("hazard_label", "River flood"),
                "difficulty_label": cfg.get("difficulty_label", "Moderate"),
                "hook": cfg.get("hook", cfg.get("description", "")),
                "illustration": cfg.get("illustration", "river"),
                "tick_duration_minutes": int(cfg.get("tick_duration_minutes", 30)),
                "languages": cfg.get("languages", ["en"]),
                "difficulties": ["easy", "standard", "hard"],
                "mechanic_type": s.mechanic.type,
                "external_support": {k: int(v) for k, v in sup.items()} if sup else None,
                "npcs": [{k: n.get(k) for k in ("id", "name", "role", "location", "initial_dialogue")}
                         for n in cfg.get("npcs", [])],
                "shelters": [{"id": sh["id"], "name": sh.get("name", sh["id"]), "capacity": int(sh.get("capacity", 0))}
                             for sh in cfg.get("shelters", [])],
            })
    return {"scenarios": scenarios}


@app.post("/api/v1/sessions", response_model=CreateSessionResponse)
def create_session(req: CreateSessionRequest):
    scenario_file = os.path.join(SCENARIOS_DIR, f"{req.scenario_id}.yaml")
    if not os.path.exists(scenario_file):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SCENARIO_NOT_FOUND", "message": f"Scenario '{req.scenario_id}' not found."},
        )

    if req.difficulty not in ("easy", "standard", "hard"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_DIFFICULTY", "message": "difficulty must be easy, standard or hard."},
        )
    if req.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_LANGUAGE", "message": f"language must be one of {SUPPORTED_LANGUAGES}."},
        )
    seed = req.seed if req.seed is not None else random.randint(1000, 999999)
    initial_state = load_scenario(scenario_file, req.difficulty)
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


@app.get("/api/v1/sessions/{session_id}/state", response_model=SessionStateResponse)
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


@app.post("/api/v1/sessions/{session_id}/turns", response_model=TurnResponse)
def submit_turn(session_id: str, req: TurnRequest):
    sess = store.get_session(session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": f"Session '{session_id}' not found."},
        )

    # Input length cap
    user_text = ""
    if req.input.get("type") == "text":
        raw_text = req.input.get("text")
        user_text = raw_text if isinstance(raw_text, str) else ("" if raw_text is None else str(raw_text))
    elif req.input.get("type") == "button":
        act_data = req.input.get("action")
        if isinstance(act_data, dict) and act_data.get("name") == "consult_npc":
            params = act_data.get("params")
            if isinstance(params, dict):
                raw_msg = params.get("user_message")
                if isinstance(raw_msg, str):
                    user_text = raw_msg

    if len(user_text) > MAX_INPUT_CHARS:
        layout = get_scenario_layout(sess["scenario_id"])
        summary = build_state_summary(sess["state"], layout)
        return {
            "status": "rejected",
            "parsed_action": None,
            "clarify": None,
            "reject_reason": f"Input text exceeds maximum limit of {MAX_INPUT_CHARS} characters.",
            "state": sess["state"],
            "layout": layout,
            "summary": summary,
            "events": [],
            "narration": {"text": f"Input exceeded limit of {MAX_INPUT_CHARS} characters.", "source": "template"},
            "npc_messages": [],
            "guardrail": {"status": "passed", "retries": 0, "fallback_reason": None},
            "source": "template",
            "llm_mode": get_llm_mode(),
            "disclaimer": DISCLAIMER_FULL_TEXT,
            "cited_rulecards": [],
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


@app.post("/api/v1/sessions/{session_id}/npc/{npc_id}/messages", response_model=NPCMessageResponse)
def consult_npc_chat(session_id: str, npc_id: str, req: NPCMessageRequest):
    sess = store.get_session(session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": f"Session '{session_id}' not found."},
        )

    # Input length cap
    if len(req.message) > MAX_INPUT_CHARS:
        layout = get_scenario_layout(sess["scenario_id"])
        summary = build_state_summary(sess["state"], layout)
        return {
            "status": "rejected",
            "parsed_action": None,
            "clarify": None,
            "reject_reason": f"Message exceeds maximum limit of {MAX_INPUT_CHARS} characters.",
            "state": sess["state"],
            "layout": layout,
            "summary": summary,
            "events": [],
            "narration": {"text": f"Message exceeded limit of {MAX_INPUT_CHARS} characters.", "source": "template"},
            "npc_messages": [],
            "guardrail": {"status": "passed", "retries": 0, "fallback_reason": None},
            "source": "template",
            "llm_mode": get_llm_mode(),
            "disclaimer": DISCLAIMER_FULL_TEXT,
            "cited_rulecards": [],
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


def build_replay_frames(scenario_id: str, actions: List[Dict[str, Any]], difficulty: str = "standard") -> List[Dict[str, Any]]:
    """Server-side deterministic replay: one summary per tick, so the browser never computes outcomes."""
    from .engine.step import step as engine_step
    fpath = os.path.join(SCENARIOS_DIR, f"{scenario_id}.yaml")
    state = load_scenario(fpath, difficulty)
    layout = get_scenario_layout(scenario_id)
    rng = random.Random(0)  # the engine does not draw from the RNG; kept for the step() signature
    frames = [{"tick": 0, "phase": state.phase, "action": None,
               "summary": build_state_summary(state.model_dump(), layout)}]
    for a in actions:
        act = Action(name=ActionName(a["name"]), params=a.get("params", {}))
        state, _ = engine_step(state, act, rng)
        frames.append({"tick": state.tick, "phase": state.phase, "action": act.model_dump(),
                       "summary": build_state_summary(state.model_dump(), layout)})
    return frames


@app.get("/api/v1/sessions/{session_id}/log", response_model=SessionLogResponse)
def get_session_log(session_id: str, frames: bool = False):
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
        "frames": build_replay_frames(sess["scenario_id"], sess["actions"], sess.get("difficulty", "standard")) if frames else None,
    }


@app.get("/api/v1/sessions/{session_id}/report", response_model=SessionReportResponse)
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
    sections = build_report_sections(state, events, score)
    return {
        "session_id": session_id,
        "score": score.model_dump(),
        "final_state": state.model_dump(),
        "events": events,
        "phases": sections["phases"],
        "causal_chain": sections["causal_chain"],
        "disclaimer": DISCLAIMER_FULL_TEXT,
    }


@app.post("/api/v1/sessions/{session_id}/end", response_model=EndSessionResponse)
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

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
