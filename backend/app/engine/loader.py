import os
from typing import Dict, Any
import yaml

from .models import (
    State,
    ZoneState,
    ShelterState,
    ResourceState,
    EmbankmentState,
)


def load_scenario(scenario_path: str) -> State:
    """Load scenario YAML file and initialize the immutable initial State."""
    if not os.path.exists(scenario_path):
        raise FileNotFoundError(f"Scenario file not found: {scenario_path}")

    with open(scenario_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    scenario_id = data["id"]
    scenario_version = data.get("version", "1.0.0")
    total_ticks = data.get("total_ticks", 24)
    forecast = data.get("water_forecast_cm", [])

    # Resources
    res_data = data.get("resources", {})
    resources = ResourceState(
        total_boats=res_data.get("boats", 2),
        available_boats=res_data.get("boats", 2),
        boat_capacity=res_data.get("boat_capacity", 15),
        total_vehicles=res_data.get("vehicles", 3),
        available_vehicles=res_data.get("vehicles", 3),
        vehicle_capacity=res_data.get("vehicle_capacity", 20),
        sandbags=res_data.get("sandbags", 400),
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
    )
