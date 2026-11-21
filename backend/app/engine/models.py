from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ActionName(str, Enum):
    ISSUE_WARNING = "issue_warning"
    ORDER_EVACUATION = "order_evacuation"
    ASSIGN_TRANSPORT = "assign_transport"
    PRIORITIZE_VULNERABLE = "prioritize_vulnerable"
    OPEN_SHELTER = "open_shelter"
    REINFORCE_EMBANKMENT = "reinforce_embankment"
    CONSULT_NPC = "consult_npc"
    WAIT = "wait"


class Action(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: ActionName
    params: Dict[str, Any] = Field(default_factory=dict)


class EventType(str, Enum):
    WARNING_ISSUED = "warning_issued"
    EVACUATION_ORDERED = "evacuation_ordered"
    TRANSPORT_ASSIGNED = "transport_assigned"
    VULNERABLE_PRIORITIZED = "vulnerable_prioritized"
    SHELTER_OPENED = "shelter_opened"
    EMBANKMENT_REINFORCED = "embankment_reinforced"
    NPC_CONSULTED = "npc_consulted"
    WATER_LEVEL_ADVANCED = "water_level_advanced"
    ROAD_INUNDATED = "road_inundated"
    ZONE_FLOODED = "zone_flooded"
    EMBANKMENT_OVERFLOW = "embankment_overflow"
    EMBANKMENT_BREACHED = "embankment_breached"
    RESIDENTS_EVACUATED = "residents_evacuated"
    VULNERABLE_EVACUATED = "vulnerable_evacuated"
    CASUALTY_OCCURRED = "casualty_occurred"
    SESSION_COMPLETED = "session_completed"
    WAIT_TICK = "wait_tick"


class Event(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: EventType
    tick: int
    description: str
    caused_by: str
    details: Dict[str, Any] = Field(default_factory=dict)


class ZoneState(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str
    name: str
    elevation_cm: int
    initial_population: int
    population_remaining: int
    initial_vulnerable: int
    vulnerable_remaining: int
    safe_evacuated: int
    vulnerable_saved: int
    in_transit: int
    lost: int
    water_depth_cm: int
    evacuation_ordered: bool
    warning_level: int
    prioritize_vulnerable: bool
    boats_assigned: int
    vehicles_assigned: int
    road_flooded: bool


class ShelterState(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str
    name: str
    elevation_cm: int
    capacity: int
    current_occupancy: int
    is_open: bool


class ResourceState(BaseModel):
    model_config = ConfigDict(frozen=True)
    total_boats: int
    available_boats: int
    boat_capacity: int
    total_vehicles: int
    available_vehicles: int
    vehicle_capacity: int
    sandbags: int


class EmbankmentState(BaseModel):
    model_config = ConfigDict(frozen=True)
    height_cm: int
    integrity: int  # 0 to 100
    breached: bool
    reinforced_count: int


class ScoreBreakdown(BaseModel):
    model_config = ConfigDict(frozen=True)
    total_score: int
    residents_safe_score: int
    vulnerable_protected_score: int
    response_time_score: int
    resource_efficiency_score: int
    infrastructure_preserved_score: int
    details: Dict[str, Any] = Field(default_factory=dict)


class State(BaseModel):
    model_config = ConfigDict(frozen=True)
    scenario_id: str
    scenario_version: str
    tick: int
    max_ticks: int
    water_level_cm: int
    forecast_cm: List[int]
    zones: Dict[str, ZoneState]
    shelters: Dict[str, ShelterState]
    resources: ResourceState
    embankment: EmbankmentState
    first_warning_tick: Optional[int] = None
    first_evacuation_tick: Optional[int] = None
    is_finished: bool = False
    score: Optional[ScoreBreakdown] = None
