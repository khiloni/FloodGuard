import os
from typing import Dict, Any
import yaml

from .models import (
    State,
    ZoneState,
    ShelterState,
    ResourceState,
    EmbankmentState,
    RecoveryConfig,
    RecoveryState,
    SupportConfig,
    MechanicConfig,
    DEFAULT_NPC_IDS,
)

DIFFICULTIES = ("easy", "standard", "hard")


def difficulty_levers(data: Dict[str, Any], difficulty: str) -> Dict[str, Any]:
    """Levers for a difficulty level; 'standard' is the scenario as written."""
    if difficulty not in DIFFICULTIES:
        raise ValueError(f"Unknown difficulty '{difficulty}'. Use one of {DIFFICULTIES}.")
    if difficulty == "standard":
        return {}
    return dict((data.get("difficulty") or {}).get(difficulty) or {})


def build_recovery_config(data: Dict[str, Any]) -> RecoveryConfig:
    """Flatten the optional `phases` and `recovery` YAML blocks into a frozen config.
    Nested `disease:` and `trust:` keys map to `disease_*` / `trust_*` fields."""
    rec = data.get("recovery")
    if not rec:
        return RecoveryConfig(enabled=False)
    flat: Dict[str, Any] = {"enabled": True}
    phases = data.get("phases", {}) or {}
    for key in ("flood_starts_at_cm", "recovery_below_cm"):
        if key in phases:
            flat[key] = int(phases[key])
    for key, val in rec.items():
        if key in ("disease", "trust") and isinstance(val, dict):
            for sub, sval in val.items():
                flat[f"{key}_{sub}"] = int(sval)
        else:
            flat[key] = int(val)
    unknown = set(flat) - set(RecoveryConfig.model_fields)
    if unknown:
        raise ValueError(f"Unknown recovery config keys: {sorted(unknown)}")
    return RecoveryConfig(**flat)


def initial_recovery_state(cfg: RecoveryConfig) -> RecoveryState:
    if not cfg.enabled:
        return RecoveryState()
    return RecoveryState(
        shelter_supplies=cfg.shelter_supplies_initial,
        supply_deliveries_left=cfg.supply_deliveries,
        clean_water_kits=cfg.clean_water_kits,
        medical_teams=cfg.medical_teams,
        community_trust=cfg.trust_initial,
    )


def load_scenario_config(scenario_path: str) -> Dict[str, Any]:
    """Load the full scenario raw YAML dict including layout and metadata."""
    if not os.path.exists(scenario_path):
        raise FileNotFoundError(f"Scenario file not found: {scenario_path}")
    with open(scenario_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_scenario(scenario_path: str, difficulty: str = "standard") -> State:
    """Load scenario YAML file and initialize the immutable initial State.
    `difficulty` applies the pack's levers (resources %, forecast offset, support delay)."""
    if not os.path.exists(scenario_path):
        raise FileNotFoundError(f"Scenario file not found: {scenario_path}")

    with open(scenario_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    scenario_id = data["id"]
    scenario_version = data.get("version", "1.0.0")
    total_ticks = data.get("total_ticks", 24)
    levers = difficulty_levers(data, difficulty)
    offset = int(levers.get("forecast_offset_cm", 0))
    forecast = [int(v) + offset for v in data.get("water_forecast_cm", [])]
    res_pct = int(levers.get("resources_pct", 100))

    def scaled(v: int, minimum: int = 0) -> int:
        return max(minimum, int(v) * res_pct // 100)

    # Resources
    res_data = data.get("resources", {})
    boats = scaled(res_data.get("boats", 2), 1)
    vehicles = scaled(res_data.get("vehicles", 3), 1)
    resources = ResourceState(
        total_boats=boats,
        available_boats=boats,
        boat_capacity=res_data.get("boat_capacity", 15),
        total_vehicles=vehicles,
        available_vehicles=vehicles,
        vehicle_capacity=res_data.get("vehicle_capacity", 20),
        sandbags=scaled(res_data.get("sandbags", 400)) // 100 * 100,
    )

    # Embankment
    emb_data = data.get("embankment", {})
    embankment = EmbankmentState(
        height_cm=emb_data.get("initial_height_cm", 380),
        integrity=emb_data.get("initial_integrity", 100),
        breached=False,
        reinforced_count=0,
    )

    # Zones
    zones: Dict[str, ZoneState] = {}
    for z in data.get("zones", []):
        zid = z["id"]
        pop = z.get("population", 100)
        vuln = z.get("vulnerable", 20)
        elev = z.get("elevation_cm", 300)
        initial_depth = max(0, (forecast[0] if forecast else 0) - elev)
        zones[zid] = ZoneState(
            id=zid,
            name=z.get("name", zid),
            elevation_cm=elev,
            initial_population=pop,
            population_remaining=pop,
            initial_vulnerable=vuln,
            vulnerable_remaining=vuln,
            safe_evacuated=0,
            vulnerable_saved=0,
            in_transit=0,
            lost=0,
            water_depth_cm=initial_depth,
            evacuation_ordered=False,
            warning_level=0,
            prioritize_vulnerable=False,
            boats_assigned=0,
            vehicles_assigned=0,
            road_flooded=False,
            households=int(z.get("households", pop // 5)),
            drain_blocked=bool(z.get("drain_blocked", False)),
            underpass=bool(z.get("underpass", False)),
        )

    # Shelters
    shelters: Dict[str, ShelterState] = {}
    for s in data.get("shelters", []):
        sid = s["id"]
        shelters[sid] = ShelterState(
            id=sid,
            name=s.get("name", sid),
            elevation_cm=s.get("elevation_cm", 500),
            capacity=s.get("capacity", 200),
            current_occupancy=0,
            is_open=s.get("is_open", False),
        )

    initial_water = forecast[0] if forecast else 150
    recovery_config = build_recovery_config(data)

    npc_ids = [n["id"] for n in data.get("npcs", []) if "id" in n] or list(DEFAULT_NPC_IDS)

    sup = data.get("external_support") or {}
    support = SupportConfig(
        uses=int(sup.get("uses", 0)),
        delay_ticks=max(1, int(sup.get("delay_ticks", 4)) + int(levers.get("support_delay_delta", 0))),
        boats=int(sup.get("boats", 0)),
        vehicles=int(sup.get("vehicles", 0)),
        sandbags=int(sup.get("sandbags", 0)),
        supply_units=int(sup.get("supply_units", 0)),
    )

    mech = data.get("mechanic") or {}
    mech_params = {k: int(v) for k, v in (mech.get("params") or {}).items()}
    mech_params.update({k: int(v) for k, v in (levers.get("mechanic_params") or {}).items()})
    mechanic = MechanicConfig(type=str(mech.get("type", "none")), params=mech_params)
    mechanic_state: Dict[str, int] = {}
    if mechanic.type == "drains":
        mechanic_state["drain_crews"] = mech_params.get("drain_crews", 2)
    if mechanic.type == "cyclone":
        mechanic_state["boats_at_sea"] = mech_params.get("fishing_boats", 0)

    return State(
        scenario_id=scenario_id,
        scenario_version=scenario_version,
        tick=0,
        max_ticks=total_ticks,
        water_level_cm=initial_water,
        forecast_cm=forecast,
        zones=zones,
        shelters=shelters,
        resources=resources,
        embankment=embankment,
        first_warning_tick=None,
        first_evacuation_tick=None,
        is_finished=False,
        score=None,
        phase="before",
        recovery=initial_recovery_state(recovery_config),
        recovery_config=recovery_config,
        difficulty=difficulty,
        npc_ids=npc_ids,
        contained_safe_elevation_cm=int(data.get("contained_safe_elevation_cm", 350)),
        embankment_max_cm=int(emb_data.get("max_reinforced_height_cm", 470)),
        foot_evacuation_per_tick=int(data.get("foot_evacuation_per_tick", 12)),
        support=support,
        support_requests_left=support.uses,
        mechanic=mechanic,
        mechanic_state=mechanic_state,
    )
