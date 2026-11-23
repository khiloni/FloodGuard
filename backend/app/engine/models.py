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
    # Recovery phase (Part 2)
    SEARCH_AND_RESCUE = "search_and_rescue"
    DISTRIBUTE_SUPPLIES = "distribute_supplies"
    PROVIDE_CLEAN_WATER = "provide_clean_water"
    RUN_MEDICAL_CAMP = "run_medical_camp"
    RESTORE_POWER = "restore_power"
    CLEAR_ROADS = "clear_roads"
    DAMAGE_SURVEY = "damage_survey"
    RETURN_RESIDENTS = "return_residents"


FLOOD_ONLY_ACTIONS = frozenset({
    ActionName.ISSUE_WARNING,
    ActionName.ORDER_EVACUATION,
    ActionName.ASSIGN_TRANSPORT,
    ActionName.PRIORITIZE_VULNERABLE,
    ActionName.REINFORCE_EMBANKMENT,
})

RECOVERY_ONLY_ACTIONS = frozenset({
    ActionName.SEARCH_AND_RESCUE,
    ActionName.PROVIDE_CLEAN_WATER,
    ActionName.RUN_MEDICAL_CAMP,
    ActionName.RESTORE_POWER,
    ActionName.CLEAR_ROADS,
    ActionName.DAMAGE_SURVEY,
    ActionName.RETURN_RESIDENTS,
})

PHASES = ("before", "flood", "recovery")


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
    # Recovery phase (Part 2)
    PHASE_CHANGED = "phase_changed"
    WATER_RECEDED = "water_receded"
    SEARCH_AND_RESCUE_COMPLETED = "search_and_rescue_completed"
    SUPPLIES_DISTRIBUTED = "supplies_distributed"
    SHELTER_SUPPLIES_LOW = "shelter_supplies_low"
    SHELTER_SUPPLIES_EXHAUSTED = "shelter_supplies_exhausted"
    CLEAN_WATER_PROVIDED = "clean_water_provided"
    MEDICAL_CAMP_OPENED = "medical_camp_opened"
    DISEASE_RISK_HIGH = "disease_risk_high"
    ILLNESS_REPORTED = "illness_reported"
    ILLNESS_TREATED = "illness_treated"
    POWER_RESTORED = "power_restored"
    HEALTH_CENTRE_REOPENED = "health_centre_reopened"
    ROAD_CLEARED = "road_cleared"
    DAMAGE_SURVEYED = "damage_surveyed"
    RESIDENTS_RETURNED = "residents_returned"


class Event(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: EventType
    tick: int
    description: str
    caused_by: str
    zone: Optional[str] = None
    target: Optional[str] = None
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
    # Recovery phase (Part 2)
    max_depth_cm: int = 0
    returned: int = 0
    road_blocked: bool = False
    surveyed: bool = False


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
    # Recovery components (Part 2); 0 if the session ends before recovery
    public_health_score: int = 0
    essential_services_score: int = 0
    safe_return_score: int = 0
    community_trust_score: int = 0
    details: Dict[str, Any] = Field(default_factory=dict)


class RecoveryConfig(BaseModel):
    """Scenario constants for phases and recovery (all integers). enabled=False keeps the
    original flood-only behaviour for scenarios without a `recovery` block."""
    model_config = ConfigDict(frozen=True)
    enabled: bool = False
    flood_starts_at_cm: int = 300
    recovery_below_cm: int = 380
    shelter_supplies_initial: int = 30
    people_per_supply_unit: int = 60
    supply_deliveries: int = 3
    units_per_delivery: int = 40
    supplies_low_threshold: int = 10
    clean_water_kits: int = 1
    medical_teams: int = 1
    return_batch_per_turn: int = 100
    treat_per_tick: int = 6
    disease_base: int = 20
    disease_per_flooded_zone: int = 10
    disease_breach_bonus: int = 10
    disease_rise_per_tick: int = 5
    disease_crowding_pct: int = 90
    disease_crowding_rise: int = 3
    disease_no_supplies_rise: int = 4
    disease_clean_water_drop: int = 8
    disease_medical_camp_drop: int = 6
    disease_high_threshold: int = 60
    trust_initial: int = 60
    trust_early_warning_bonus: int = 10
    trust_early_warning_by_tick: int = 6
    trust_losses_penalty: int = 10
    trust_breach_penalty: int = 10
    trust_supplies_ran_out_penalty: int = 10
    road_debris_depth_cm: int = 30


class RecoveryState(BaseModel):
    model_config = ConfigDict(frozen=True)
    shelter_supplies: int = 0
    supply_deliveries_left: int = 0
    supply_shortfall_ticks: int = 0
    supplies_low_warned: bool = False
    clean_water_kits: int = 0
    clean_water_active: bool = False
    medical_teams: int = 0
    medical_camp_active: bool = False
    disease_risk: int = 0
    peak_disease_risk: int = 0
    illness_cases: int = 0
    illness_treated: int = 0
    power_on: bool = True
    health_centre_open: bool = True
    community_trust: int = 0


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
    # Phases and recovery (Part 2)
    phase: str = "before"
    flood_start_tick: Optional[int] = None
    recovery_start_tick: Optional[int] = None
    recovery: RecoveryState = Field(default_factory=RecoveryState)
    recovery_config: RecoveryConfig = Field(default_factory=RecoveryConfig)
