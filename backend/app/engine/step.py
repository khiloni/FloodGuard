import random
from typing import Tuple, List, Dict, Any, Optional
from .models import (
    State,
    Action,
    ActionName,
    Event,
    EventType,
    ZoneState,
    ShelterState,
    ResourceState,
    EmbankmentState,
)
from .scoring import calculate_score
from .rules import validate_action_preconditions


def step(state: State, action: Action, rng: random.Random) -> Tuple[State, List[Event]]:
    """Execute one simulation tick deterministically.
    Returns (new_state, events).
    Precondition: action must pass validate_action_preconditions.
    """
    is_valid, reject_reason = validate_action_preconditions(state, action)
    if not is_valid:
        raise ValueError(f"Illegal action submitted to engine: {reject_reason}")

    events: List[Event] = []
    current_tick = state.tick + 1
    new_first_warning = state.first_warning_tick
    new_first_evacuation = state.first_evacuation_tick

    # 1. Clone mutable local dictionaries for sorted processing
    zones: Dict[str, ZoneState] = dict(state.zones)
    shelters: Dict[str, ShelterState] = dict(state.shelters)
    
    res = state.resources
    total_boats = res.total_boats
    avail_boats = res.available_boats
    boat_cap = res.boat_capacity
    total_vehs = res.total_vehicles
    avail_vehs = res.available_vehicles
    veh_cap = res.vehicle_capacity
    sandbags = res.sandbags

    emb_height = state.embankment.height_cm
    emb_integrity = state.embankment.integrity
    emb_breached = state.embankment.breached
    emb_reinforced = state.embankment.reinforced_count

    # 2. Process Action
    action_name = action.name
    params = action.params

    if action_name == ActionName.ISSUE_WARNING:
        if new_first_warning is None:
            new_first_warning = current_tick
        target_zone = params.get("zone")
        for zid in sorted(zones.keys()):
            if not target_zone or target_zone == zid:
                z = zones[zid]
                new_w = min(2, z.warning_level + 1)
                zones[zid] = z.model_copy(update={"warning_level": new_w})
        events.append(
            Event(
                type=EventType.WARNING_ISSUED,
                tick=current_tick,
                description=f"Public flood warning broadcast to {target_zone or 'all community zones'}.",
                caused_by=f"Action {action_name.value}",
                zone=target_zone,
                target=target_zone or "all",
                details={"zone": target_zone, "target": target_zone or "all", "new_warning_level": 2 if not target_zone else zones[target_zone].warning_level},
            )
        )

    elif action_name == ActionName.ORDER_EVACUATION:
        if new_first_evacuation is None:
            new_first_evacuation = current_tick
        target_zone = params.get("zone")
        z = zones[target_zone]
        zones[target_zone] = z.model_copy(update={"evacuation_ordered": True})
        events.append(
            Event(
                type=EventType.EVACUATION_ORDERED,
                tick=current_tick,
                description=f"Mandatory evacuation ordered for {z.name}.",
                caused_by=f"Action {action_name.value}",
                zone=target_zone,
                target=target_zone,
                details={"zone": target_zone, "target": target_zone},
            )
        )

    elif action_name == ActionName.ASSIGN_TRANSPORT:
        target_zone = params.get("zone")
        ttype = params.get("transport_type")
        count = int(params.get("count", 1))
        z = zones[target_zone]

        if ttype == "boat":
            avail_boats -= count
            new_boats = z.boats_assigned + count
            zones[target_zone] = z.model_copy(update={"boats_assigned": new_boats})
            events.append(
                Event(
                    type=EventType.TRANSPORT_ASSIGNED,
                    tick=current_tick,
                    description=f"Assigned {count} motorized rescue boat(s) to {z.name}.",
                    caused_by=f"Action {action_name.value}",
                    zone=target_zone,
                    target=target_zone,
                    details={"zone": target_zone, "target": target_zone, "transport_type": "boat", "count": count},
                )
            )
        elif ttype == "vehicle":
            avail_vehs -= count
            new_vehs = z.vehicles_assigned + count
            zones[target_zone] = z.model_copy(update={"vehicles_assigned": new_vehs})
            events.append(
                Event(
                    type=EventType.TRANSPORT_ASSIGNED,
                    tick=current_tick,
                    description=f"Dispatched {count} transport truck(s) to {z.name}.",
                    caused_by=f"Action {action_name.value}",
                    zone=target_zone,
                    target=target_zone,
                    details={"zone": target_zone, "target": target_zone, "transport_type": "vehicle", "count": count},
                )
            )

    elif action_name == ActionName.PRIORITIZE_VULNERABLE:
        target_zone = params.get("zone")
        z = zones[target_zone]
        zones[target_zone] = z.model_copy(update={"prioritize_vulnerable": True})
        events.append(
            Event(
                type=EventType.VULNERABLE_PRIORITIZED,
                tick=current_tick,
                description=f"Rescue priority activated for vulnerable residents in {z.name}.",
                caused_by=f"Action {action_name.value}",
                zone=target_zone,
                target=target_zone,
                details={"zone": target_zone, "target": target_zone},
            )
        )

    elif action_name == ActionName.OPEN_SHELTER:
        shelter_id = params.get("shelter_id")
        s = shelters[shelter_id]
        shelters[shelter_id] = s.model_copy(update={"is_open": True})
        events.append(
            Event(
                type=EventType.SHELTER_OPENED,
                tick=current_tick,
                description=f"Shelter '{s.name}' officially opened with intake capacity of {s.capacity}.",
                caused_by=f"Action {action_name.value}",
                zone=None,
                target=shelter_id,
                details={"zone": None, "target": shelter_id, "shelter_id": shelter_id, "capacity": s.capacity},
            )
        )

    elif action_name == ActionName.REINFORCE_EMBANKMENT:
        bags_used = int(params.get("sandbags", 100))
        sandbags -= bags_used
        emb_reinforced += 1
        # Each 100 sandbags raises effective bund height by 30 cm and boosts integrity
        height_gain = (bags_used // 100) * 30
        emb_height = min(470, emb_height + height_gain)
        emb_integrity = min(100, emb_integrity + 10)
        events.append(
            Event(
                type=EventType.EMBANKMENT_REINFORCED,
                tick=current_tick,
                description=f"Crews laid {bags_used} sandbags. Embankment height raised to {emb_height} cm (integrity {emb_integrity}%).",
                caused_by=f"Action {action_name.value}",
                zone=None,
                target="embankment",
                details={"zone": None, "target": "embankment", "sandbags_used": bags_used, "new_height_cm": emb_height, "new_integrity": emb_integrity},
            )
        )

    elif action_name == ActionName.CONSULT_NPC:
        npc_id = params.get("npc_id", "village_head")
        events.append(
            Event(
                type=EventType.NPC_CONSULTED,
                tick=current_tick,
                description=f"Consultation held with character '{npc_id}'.",
                caused_by=f"Action {action_name.value}",
                zone=None,
                target=npc_id,
                details={"zone": None, "target": npc_id, "npc_id": npc_id},
            )
        )

    elif action_name == ActionName.WAIT:
        events.append(
            Event(
                type=EventType.WAIT_TICK,
                tick=current_tick,
                description="Status quo maintained; observation period elapsed.",
                caused_by=f"Action {action_name.value}",
                zone=None,
                target="system",
                details={"zone": None, "target": "system"},
            )
        )

    # 3. Advance Water Level along forecast
    forecast_idx = min(current_tick - 1, len(state.forecast_cm) - 1)
    new_water_level = state.forecast_cm[forecast_idx]

    events.append(
        Event(
            type=EventType.WATER_LEVEL_ADVANCED,
            tick=current_tick,
            description=f"River water level reached {new_water_level} cm.",
            caused_by="Hydrological Forecast Curve",
            zone=None,
            target="river",
            details={"zone": None, "target": "river", "water_level_cm": new_water_level, "tick": current_tick},
        )
    )

    # 4. Embankment Overtopping and Structural Integrity
    if new_water_level > emb_height and not emb_breached:
        overflow_cm = new_water_level - emb_height
        integrity_loss = max(15, overflow_cm * 2)
        emb_integrity = max(0, emb_integrity - integrity_loss)
        events.append(
            Event(
                type=EventType.EMBANKMENT_OVERFLOW,
                tick=current_tick,
                description=f"Floodwaters overtopped embankment crest by {overflow_cm} cm! Integrity down to {emb_integrity}%.",
                caused_by="River level exceeding embankment crest",
                zone=None,
                target="embankment",
                details={"zone": None, "target": "embankment", "overflow_cm": overflow_cm, "remaining_integrity": emb_integrity},
            )
        )
        if emb_integrity <= 0:
            emb_breached = True
            events.append(
                Event(
                    type=EventType.EMBANKMENT_BREACHED,
                    tick=current_tick,
                    description="Embankment barrier collapsed under intense hydraulic pressure! Uncontrolled inundation.",
                    caused_by="Embankment structural integrity reached 0%",
                    zone=None,
                    target="embankment",
                    details={"zone": None, "target": "embankment"},
                )
            )

    # 5. Update Zone Inundation and Road Status
    for zid in sorted(zones.keys()):
        z = zones[zid]
        effective_water = new_water_level
        # If embankment breached, water rushes faster; if intact and below embankment, river is contained
        if not emb_breached and new_water_level <= emb_height:
            # Containment reduces localized spill into higher ground
            local_depth = max(0, new_water_level - z.elevation_cm)
            if z.elevation_cm >= 350:
                local_depth = 0
        else:
            local_depth = max(0, effective_water - z.elevation_cm)

        road_submerged = local_depth >= 30  # 30 cm cutoff for road traffic

        if road_submerged and not z.road_flooded:
            events.append(
                Event(
                    type=EventType.ROAD_INUNDATED,
                    tick=current_tick,
                    description=f"Access road to {z.name} submerged beneath {local_depth} cm of water. Wheeled transport blocked.",
                    caused_by="Flood depth exceeding road clearance threshold",
                    zone=zid,
                    target=zid,
                    details={"zone": zid, "target": zid, "water_depth_cm": local_depth},
                )
            )

        if local_depth > 0 and z.water_depth_cm == 0:
            events.append(
                Event(
                    type=EventType.ZONE_FLOODED,
                    tick=current_tick,
                    description=f"Water breached into {z.name}. Depth reached {local_depth} cm.",
                    caused_by="River overtopping local elevation",
                    zone=zid,
                    target=zid,
                    details={"zone": zid, "target": zid, "water_depth_cm": local_depth},
                )
            )

        zones[zid] = z.model_copy(
            update={
                "water_depth_cm": local_depth,
                "road_flooded": road_submerged,
            }
        )

    # 6. Resolve Evacuation Movement
    # Available shelter intake space
    open_shelters = [s for s in shelters.values() if s.is_open]
    total_shelter_capacity_left = sum(s.capacity - s.current_occupancy for s in open_shelters)

    for zid in sorted(zones.keys()):
        z = zones[zid]
        if z.population_remaining <= 0:
            continue

        # Evacuation willingness fraction
        if z.evacuation_ordered:
            willing_ratio = 1.0
        elif z.water_depth_cm > 20:
            willing_ratio = 0.95
        elif z.warning_level == 2:
            willing_ratio = 0.75
        elif z.warning_level == 1:
            willing_ratio = 0.45
        else:
            willing_ratio = 0.10

        willing_pop = int(round(z.population_remaining * willing_ratio))
        if willing_pop <= 0 and z.population_remaining > 0 and (z.water_depth_cm > 0 or z.evacuation_ordered):
            willing_pop = min(z.population_remaining, 5)

        # Transport capacity available in this zone
        transport_capacity = 0
        transport_capacity += z.boats_assigned * boat_cap
        if not z.road_flooded:
            transport_capacity += z.vehicles_assigned * veh_cap
        # Foot evacuation if water is shallow (under 15 cm) and shelter is open
        if z.water_depth_cm < 15 and z.evacuation_ordered and total_shelter_capacity_left > 0:
            transport_capacity += 12  # On-foot guided group

        # Cap movement by willingness, transport, and remaining shelter space
        evacuees = min(willing_pop, transport_capacity, total_shelter_capacity_left)

        if evacuees > 0:
            # Determine vulnerable portion
            if z.prioritize_vulnerable:
                v_moved = min(evacuees, z.vulnerable_remaining)
            else:
                # Proportional vulnerable movement
                if z.population_remaining > 0:
                    v_ratio = z.vulnerable_remaining / z.population_remaining
                    v_moved = min(z.vulnerable_remaining, int(round(evacuees * v_ratio)))
                else:
                    v_moved = 0

            new_pop_remaining = z.population_remaining - evacuees
            new_vuln_remaining = z.vulnerable_remaining - v_moved
            new_safe = z.safe_evacuated + evacuees
            new_vuln_saved = z.vulnerable_saved + v_moved

            zones[zid] = z.model_copy(
                update={
                    "population_remaining": new_pop_remaining,
                    "vulnerable_remaining": new_vuln_remaining,
                    "safe_evacuated": new_safe,
                    "vulnerable_saved": new_vuln_saved,
                }
            )

            # Distribute into open shelters
            assigned_to_shelters = evacuees
            for sid in sorted(shelters.keys()):
                sh = shelters[sid]
                if not sh.is_open:
                    continue
                free_space = sh.capacity - sh.current_occupancy
                if free_space > 0 and assigned_to_shelters > 0:
                    take = min(assigned_to_shelters, free_space)
                    shelters[sid] = sh.model_copy(update={"current_occupancy": sh.current_occupancy + take})
                    assigned_to_shelters -= take
                    total_shelter_capacity_left -= take

            events.append(
                Event(
                    type=EventType.RESIDENTS_EVACUATED,
                    tick=current_tick,
                    description=f"Evacuated {evacuees} residents from {z.name} to safety.",
                    caused_by="Active evacuation transport and open shelter capacity",
                    zone=zid,
                    target=zid,
                    details={"zone": zid, "target": zid, "evacuated": evacuees, "vulnerable_included": v_moved},
                )
            )

            if v_moved > 0:
                events.append(
                    Event(
                        type=EventType.VULNERABLE_EVACUATED,
                        tick=current_tick,
                        description=f"{v_moved} vulnerable individuals from {z.name} reached secure shelter.",
                        caused_by="Vulnerability priority protocol",
                        zone=zid,
                        target=zid,
                        details={"zone": zid, "target": zid, "vulnerable_count": v_moved},
                    )
                )

    # 7. Hazard and Casualties calculation
    # If deep hazardous flood occurs (depth > 120 cm) and residents remain without boats:
    for zid in sorted(zones.keys()):
        z = zones[zid]
        if z.population_remaining > 0 and z.water_depth_cm >= 150:
            # Danger factor: if no boats assigned and deep flood
            if z.boats_assigned == 0:
                # Small attrition if trapped in extreme flood
                casualty_rate = 0.05 if z.prioritize_vulnerable else 0.10
                new_casualties = max(1, int(round(z.population_remaining * casualty_rate)))
                new_casualties = min(z.population_remaining, new_casualties)

                new_pop_remaining = z.population_remaining - new_casualties
                new_lost = z.lost + new_casualties
                
                # Check vulnerable casualty
                vuln_loss = min(z.vulnerable_remaining, new_casualties)
                new_vuln_remaining = z.vulnerable_remaining - vuln_loss

                zones[zid] = z.model_copy(
                    update={
                        "population_remaining": new_pop_remaining,
                        "vulnerable_remaining": new_vuln_remaining,
                        "lost": new_lost,
                    }
                )

                events.append(
                    Event(
                        type=EventType.CASUALTY_OCCURRED,
                        tick=current_tick,
                        description=f"Severe flooding ({z.water_depth_cm} cm) stranded residents in {z.name}! {new_casualties} casualties reported.",
                        caused_by="Extreme inundation without sufficient rescue watercraft",
                        zone=zid,
                        target=zid,
                        details={"zone": zid, "target": zid, "casualties": new_casualties, "depth_cm": z.water_depth_cm},
                    )
                )

    # 8. Check Session Completion
    is_finished = (
        current_tick >= state.max_ticks
        or sum(z.population_remaining for z in zones.values()) == 0
    )

    new_res_state = ResourceState(
        total_boats=total_boats,
        available_boats=avail_boats,
        boat_capacity=boat_cap,
        total_vehicles=total_vehs,
        available_vehicles=avail_vehs,
        vehicle_capacity=veh_cap,
        sandbags=sandbags,
    )

    new_emb_state = EmbankmentState(
        height_cm=emb_height,
        integrity=emb_integrity,
        breached=emb_breached,
        reinforced_count=emb_reinforced,
    )

    intermediate_state = State(
        scenario_id=state.scenario_id,
        scenario_version=state.scenario_version,
        tick=current_tick,
        max_ticks=state.max_ticks,
        water_level_cm=new_water_level,
        forecast_cm=state.forecast_cm,
        zones=zones,
        shelters=shelters,
        resources=new_res_state,
        embankment=new_emb_state,
        first_warning_tick=new_first_warning,
        first_evacuation_tick=new_first_evacuation,
        is_finished=is_finished,
        score=None,
    )

    if is_finished:
        final_score = calculate_score(intermediate_state)
        intermediate_state = intermediate_state.model_copy(update={"score": final_score})
        events.append(
            Event(
                type=EventType.SESSION_COMPLETED,
                tick=current_tick,
                description=f"Simulation ended. Final Community Resilience Score: {final_score.total_score}/100.",
                caused_by="Maximum duration reached or complete evacuation achieved",
                zone=None,
                target="system",
                details={"zone": None, "target": "system", "score": final_score.total_score},
            )
        )

    return intermediate_state, events
