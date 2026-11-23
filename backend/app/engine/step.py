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
    RecoveryState,
)
from .models import MECHANIC_ACTIONS
from . import mechanics
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

    cfg = state.recovery_config
    rec: Dict[str, Any] = state.recovery.model_dump()
    phase = state.phase
    flood_start_tick = state.flood_start_tick
    recovery_start_tick = state.recovery_start_tick
    phase_marks: List[Tuple[int, str]] = []  # (event index, phase) where a new phase begins
    ms: Dict[str, int] = dict(state.mechanic_state)
    support_left = state.support_requests_left
    support_eta = state.support_eta_tick
    before_resources = {
        "boats": state.resources.available_boats,
        "vehicles": state.resources.available_vehicles,
        "sandbags": state.resources.sandbags,
        "supply deliveries": state.recovery.supply_deliveries_left,
    }

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
        emb_height = min(state.embankment_max_cm, emb_height + height_gain)
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

    elif action_name == ActionName.REQUEST_EXTERNAL_SUPPORT:
        support_eta = mechanics.request_support(state, events, current_tick)
        support_left -= 1

    elif action_name in MECHANIC_ACTIONS:
        mechanics.apply_mechanic_action(state, action, zones, ms, events, current_tick)

    elif action_name in RECOVERY_HANDLED:
        avail_boats, avail_vehs = _apply_recovery_action(
            action, state, zones, shelters, rec, events, current_tick,
            total_boats, boat_cap, total_vehs, veh_cap, avail_boats, avail_vehs,
        )

    # 2b. Outside support arrives (requested earlier)
    if support_eta is not None and current_tick >= support_eta:
        sup = state.support
        total_boats += sup.boats
        avail_boats += sup.boats
        total_vehs += sup.vehicles
        avail_vehs += sup.vehicles
        sandbags += sup.sandbags
        if cfg.enabled and sup.supply_units:
            rec["shelter_supplies"] += sup.supply_units
            rec["supplies_low_warned"] = False
        support_eta = None
        events.append(Event(
            type=EventType.SUPPORT_ARRIVED, tick=current_tick,
            description=(f"A district convoy arrived with {sup.boats} boats, {sup.vehicles} trucks, "
                         f"{sup.sandbags} sandbags and {sup.supply_units} supply units."),
            caused_by="Outside support requested earlier", zone=None, target="district",
            details={"zone": None, "target": "district", "boats": sup.boats, "vehicles": sup.vehicles,
                     "sandbags": sup.sandbags, "supply_units": sup.supply_units},
        ))

    # 3. Advance Water Level along forecast (plus any scenario mechanic such as a dam release)
    new_water_level = mechanics.water_level_at(state, current_tick, ms)

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

    water_event_index = len(events)

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
            if z.elevation_cm >= state.contained_safe_elevation_cm:
                local_depth = 0
        else:
            local_depth = max(0, effective_water - z.elevation_cm)

        # Blocked drains add street water while it rains (urban mechanic)
        extra = mechanics.extra_depth(state, z, mechanics.is_raining(state, current_tick))
        if extra:
            with_drains = max(0, new_water_level + extra - z.elevation_cm)
            if with_drains > local_depth:
                if local_depth == 0 and not ms.get(f"overflow_{zid}"):
                    ms[f"overflow_{zid}"] = 1
                    events.append(Event(
                        type=EventType.DRAIN_OVERFLOW, tick=current_tick,
                        description=f"Blocked drains overflowed in {z.name}; streets are filling with water.",
                        caused_by="Drains blocked by debris during heavy rain", zone=zid, target=zid,
                        details={"zone": zid, "target": zid, "extra_cm": extra},
                    ))
                local_depth = with_drains

        road_submerged = local_depth >= mechanics.road_cutoff_cm(state, z)  # 30 cm default cutoff

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

        if cfg.enabled and local_depth == 0 and z.water_depth_cm > 0:
            events.append(
                Event(
                    type=EventType.WATER_RECEDED,
                    tick=current_tick,
                    description=f"Floodwater has drained from {z.name}.",
                    caused_by="River level fell below the ward's ground level",
                    zone=zid,
                    target=zid,
                    details={"zone": zid, "target": zid, "water_depth_cm": 0, "max_depth_cm": max(z.max_depth_cm, z.water_depth_cm)},
                )
            )

        zones[zid] = z.model_copy(
            update={
                "water_depth_cm": local_depth,
                "road_flooded": road_submerged,
                "max_depth_cm": max(z.max_depth_cm, local_depth),
            }
        )

    # Before -> flood: river at warning level, or water inside any ward (Part 2)
    if cfg.enabled and phase == "before":
        wet = [zid for zid in sorted(zones) if zones[zid].water_depth_cm > 0]
        if new_water_level >= cfg.flood_starts_at_cm or wet:
            phase_marks.append((water_event_index, "flood"))
            phase = "flood"
            flood_start_tick = current_tick
            if new_water_level >= cfg.flood_starts_at_cm:
                cause = f"River level reached the warning level of {cfg.flood_starts_at_cm} cm"
            else:
                cause = f"Floodwater entered {zones[wet[0]].name}"
            events.insert(water_event_index, Event(
                type=EventType.PHASE_CHANGED,
                tick=current_tick,
                description=f"The river reached {new_water_level} cm and water is entering homes. The flood phase has begun.",
                caused_by=cause,
                zone=None,
                target="system",
                details={"zone": None, "target": "system", "from_phase": "before", "to_phase": "flood",
                         "water_level_cm": new_water_level},
            ))

    # 6. Resolve Evacuation Movement
    # Available shelter intake space
    open_shelters = [s for s in shelters.values() if s.is_open]
    total_shelter_capacity_left = sum(s.capacity - s.current_occupancy for s in open_shelters)

    for zid in sorted(zones.keys()):
        z = zones[zid]
        if z.population_remaining <= 0:
            continue
        if state.phase == "recovery":
            # After the flood, stranded residents need search_and_rescue (Part 2).
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
            transport_capacity += state.foot_evacuation_per_tick  # On-foot guided group

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

    # 7a. Scheduled scenario events (dam notice/release, cyclone landfall, boats returning)
    mechanics.tick_mechanics(state, ms, events, current_tick, new_water_level)

    # 7b. Phases and recovery (Part 2)
    if cfg.enabled:
        recovery_ticked_before = phase == "recovery"
        if phase == "flood" and current_tick > _peak_tick(state.forecast_cm) and new_water_level < cfg.recovery_below_cm:
            phase_marks.append((len(events), "recovery"))
            phase = "recovery"
            recovery_start_tick = current_tick
            avail_boats, avail_vehs = total_boats, total_vehs
            _enter_recovery(state, zones, rec, events, current_tick, emb_breached, new_first_warning, new_water_level, ms)

        _consume_supplies(cfg, shelters, rec, events, current_tick)

        if recovery_ticked_before:
            _recovery_tick(cfg, zones, shelters, rec, events, current_tick)

    # 8. Check Session Completion
    if cfg.enabled:
        is_finished = current_tick >= state.max_ticks
    else:
        is_finished = (
            current_tick >= state.max_ticks
            or sum(z.population_remaining for z in zones.values()) == 0
        )

    # Resources that ran out this tick
    after_resources = {
        "boats": avail_boats,
        "vehicles": avail_vehs,
        "sandbags": sandbags,
        "supply deliveries": rec.get("supply_deliveries_left", 0),
    }
    for res_name, before in before_resources.items():
        if before > 0 and after_resources[res_name] == 0:
            events.append(Event(
                type=EventType.RESOURCE_DEPLETED, tick=current_tick,
                description=f"No {res_name} are left in reserve.",
                caused_by="All units committed or used", zone=None, target=res_name,
                details={"zone": None, "target": res_name, "resource": res_name},
            ))

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
        phase=phase,
        flood_start_tick=flood_start_tick,
        recovery_start_tick=recovery_start_tick,
        recovery=RecoveryState(**rec),
        recovery_config=cfg,
        difficulty=state.difficulty,
        npc_ids=state.npc_ids,
        contained_safe_elevation_cm=state.contained_safe_elevation_cm,
        embankment_max_cm=state.embankment_max_cm,
        foot_evacuation_per_tick=state.foot_evacuation_per_tick,
        support=state.support,
        support_requests_left=support_left,
        support_eta_tick=support_eta,
        mechanic=state.mechanic,
        mechanic_state=ms,
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

    if cfg.enabled:
        events = _tag_phases(events, state.phase, phase_marks)
    return intermediate_state, events



# =========================================================================
# Recovery phase helpers (Part 2). Integer-only arithmetic.
# =========================================================================

RECOVERY_HANDLED = frozenset({
    ActionName.SEARCH_AND_RESCUE,
    ActionName.DISTRIBUTE_SUPPLIES,
    ActionName.PROVIDE_CLEAN_WATER,
    ActionName.RUN_MEDICAL_CAMP,
    ActionName.RESTORE_POWER,
    ActionName.CLEAR_ROADS,
    ActionName.DAMAGE_SURVEY,
    ActionName.RETURN_RESIDENTS,
})


def _clamp(value: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, value))


def _peak_tick(forecast: List[int]) -> int:
    if not forecast:
        return 0
    return forecast.index(max(forecast)) + 1


def _ev(etype: EventType, tick: int, description: str, caused_by: str,
        zone: Optional[str] = None, target: Optional[str] = None, **details: Any) -> Event:
    return Event(
        type=etype, tick=tick, description=description, caused_by=caused_by,
        zone=zone, target=target if target is not None else (zone or "system"),
        details={"zone": zone, "target": target if target is not None else (zone or "system"), **details},
    )


def _occupancy(shelters: Dict[str, ShelterState]) -> int:
    return sum(s.current_occupancy for s in shelters.values())


def _admit(shelters: Dict[str, ShelterState], count: int) -> int:
    """Place `count` people into open shelters in id order. Returns how many were placed."""
    placed = 0
    for sid in sorted(shelters.keys()):
        sh = shelters[sid]
        if not sh.is_open or count - placed <= 0:
            continue
        take = min(count - placed, sh.capacity - sh.current_occupancy)
        if take > 0:
            shelters[sid] = sh.model_copy(update={"current_occupancy": sh.current_occupancy + take})
            placed += take
    return placed


def _discharge(shelters: Dict[str, ShelterState], count: int) -> int:
    removed = 0
    for sid in sorted(shelters.keys()):
        sh = shelters[sid]
        take = min(count - removed, sh.current_occupancy)
        if take > 0:
            shelters[sid] = sh.model_copy(update={"current_occupancy": sh.current_occupancy - take})
            removed += take
    return removed


def _apply_recovery_action(action, state, zones, shelters, rec, events, tick,
                           total_boats, boat_cap, total_vehs, veh_cap, avail_boats, avail_vehs):
    name = action.name
    params = action.params
    cfg = state.recovery_config
    by = f"Action {name.value}"

    if name == ActionName.DISTRIBUTE_SUPPLIES:
        rec["shelter_supplies"] += cfg.units_per_delivery
        rec["supply_deliveries_left"] -= 1
        rec["supplies_low_warned"] = False
        events.append(_ev(
            EventType.SUPPLIES_DISTRIBUTED, tick,
            f"A relief delivery of {cfg.units_per_delivery} supply units reached the shelter. "
            f"Stock is now {rec['shelter_supplies']} units.",
            by, target=params.get("shelter_id") or "shelter",
            units=cfg.units_per_delivery, shelter_supplies=rec["shelter_supplies"],
            deliveries_left=rec["supply_deliveries_left"]))

    elif name == ActionName.PROVIDE_CLEAN_WATER:
        rec["clean_water_kits"] -= 1
        rec["clean_water_active"] = True
        events.append(_ev(
            EventType.CLEAN_WATER_PROVIDED, tick,
            "A water purification point started supplying safe drinking water to the shelter and wards.",
            by, target="water_point", disease_risk=rec["disease_risk"]))

    elif name == ActionName.RUN_MEDICAL_CAMP:
        rec["medical_teams"] -= 1
        rec["medical_camp_active"] = True
        events.append(_ev(
            EventType.MEDICAL_CAMP_OPENED, tick,
            "A medical camp opened beside the shelter to check residents and treat illness.",
            by, target="medical_camp",
            untreated=rec["illness_cases"] - rec["illness_treated"]))

    elif name == ActionName.RESTORE_POWER:
        rec["power_on"] = True
        rec["health_centre_open"] = True
        rec["community_trust"] = _clamp(rec["community_trust"] + 3)
        events.append(_ev(
            EventType.POWER_RESTORED, tick,
            "Repair crews restored electricity from the substation.",
            by, target="substation"))
        events.append(_ev(
            EventType.HEALTH_CENTRE_REOPENED, tick,
            "With power back, the village health centre reopened.",
            "Power restored", target="health_centre"))

    else:
        zid = params.get("zone")
        z = zones[zid]
        if name == ActionName.SEARCH_AND_RESCUE:
            road_ok = not z.road_flooded and not z.road_blocked
            capacity = total_boats * boat_cap + (total_vehs * veh_cap if road_ok else 0)
            space = sum(sh.capacity - sh.current_occupancy for sh in shelters.values() if sh.is_open)
            n = min(z.population_remaining, capacity, space)
            vuln = min(n, z.vulnerable_remaining)
            placed = _admit(shelters, n)
            n = placed
            vuln = min(vuln, n)
            zones[zid] = z.model_copy(update={
                "population_remaining": z.population_remaining - n,
                "vulnerable_remaining": z.vulnerable_remaining - vuln,
                "safe_evacuated": z.safe_evacuated + n,
                "vulnerable_saved": z.vulnerable_saved + vuln,
            })
            if n > 0:
                rec["community_trust"] = _clamp(rec["community_trust"] + 2)
            events.append(_ev(
                EventType.SEARCH_AND_RESCUE_COMPLETED, tick,
                f"Search teams rescued {n} stranded residents from {z.name} and brought them to the shelter.",
                by, zone=zid, rescued=n, vulnerable_included=vuln,
                still_stranded=z.population_remaining - n))

        elif name == ActionName.CLEAR_ROADS:
            zones[zid] = z.model_copy(update={"road_blocked": False})
            events.append(_ev(
                EventType.ROAD_CLEARED, tick,
                f"Crews cleared debris from the road to {z.name}.",
                by, zone=zid))

        elif name == ActionName.DAMAGE_SURVEY:
            zones[zid] = z.model_copy(update={"surveyed": True})
            events.append(_ev(
                EventType.DAMAGE_SURVEYED, tick,
                f"Engineers surveyed {z.name}: {z.damaged_houses} of {z.households} houses damaged; the water had reached {z.max_depth_cm} cm.",
                by, zone=zid, max_depth_cm=z.max_depth_cm, damaged_houses=z.damaged_houses,
                households=z.households))

        elif name == ActionName.RETURN_RESIDENTS:
            waiting = z.safe_evacuated - z.returned
            n = _discharge(shelters, min(waiting, cfg.return_batch_per_turn))
            zones[zid] = z.model_copy(update={"returned": z.returned + n})
            rec["community_trust"] = _clamp(rec["community_trust"] + 3)
            events.append(_ev(
                EventType.RESIDENTS_RETURNED, tick,
                f"{n} residents of {z.name} returned home from the shelter.",
                by, zone=zid, returned=n, still_in_shelter=waiting - n))

    return avail_boats, avail_vehs


def _enter_recovery(state, zones, rec, events, tick, breached, first_warning, water_level, ms=None):
    cfg = state.recovery_config
    flooded = [zid for zid in sorted(zones) if zones[zid].max_depth_cm > 0]
    debris = [zid for zid in sorted(zones) if zones[zid].max_depth_cm >= cfg.road_debris_depth_cm]
    for zid in sorted(zones):
        z = zones[zid]
        households = z.households or z.initial_population // 5
        damage_pct = _clamp((z.max_depth_cm - 30) * 100 // 220) if z.max_depth_cm > 30 else 0
        zones[zid] = z.model_copy(update={
            "road_blocked": zid in debris,
            "boats_assigned": 0,
            "vehicles_assigned": 0,
            "households": households,
            "damaged_houses": households * damage_pct // 100,
        })

    power_on = (not breached) and not debris and not (ms or {}).get("power_down", 0)
    disease = _clamp(cfg.disease_base + cfg.disease_per_flooded_zone * len(flooded)
                     + (cfg.disease_breach_bonus if breached else 0))
    lost = sum(z.lost for z in zones.values())
    trust = cfg.trust_initial
    if first_warning is not None and first_warning <= cfg.trust_early_warning_by_tick:
        trust += cfg.trust_early_warning_bonus
    if lost > 0:
        trust -= cfg.trust_losses_penalty
    if breached:
        trust -= cfg.trust_breach_penalty
    if rec["supply_shortfall_ticks"] > 0:
        trust -= cfg.trust_supplies_ran_out_penalty
    trust = _clamp(trust)

    rec.update({
        "water_contamination": _clamp(20 + 20 * len(flooded) + (20 if breached else 0)),
        "power_on": power_on,
        "health_centre_open": power_on,
        "disease_risk": disease,
        "peak_disease_risk": disease,
        "community_trust": trust,
    })

    causes = []
    if breached:
        causes.append("the embankment breach")
    if debris:
        causes.append(f"deep water in {len(debris)} ward(s)")
    events.append(_ev(
        EventType.PHASE_CHANGED, tick,
        f"The river fell to {water_level} cm after the peak. The recovery phase has begun"
        + ("; power is out and roads are blocked by debris." if not power_on else "."),
        f"River level dropped below the danger level of {cfg.recovery_below_cm} cm after the peak",
        target="system", from_phase="flood", to_phase="recovery",
        water_level_cm=water_level, disease_risk=disease, community_trust=trust,
        power_on=power_on, flooded_zones=len(flooded), roads_blocked=len(debris),
        power_out_cause=", ".join(causes) if not power_on else None,
        transport_released=True))


def _consume_supplies(cfg, shelters, rec, events, tick):
    occ = _occupancy(shelters)
    if occ <= 0:
        return
    use = (occ + cfg.people_per_supply_unit - 1) // cfg.people_per_supply_unit
    before = rec["shelter_supplies"]
    rec["shelter_supplies"] = max(0, before - use)
    if rec["shelter_supplies"] == 0:
        rec["supply_shortfall_ticks"] += 1
        if before > 0:
            events.append(_ev(
                EventType.SHELTER_SUPPLIES_EXHAUSTED, tick,
                f"The shelter ran out of food and essentials for its {occ} residents.",
                f"{occ} people sheltered use {use} supply units per tick and no delivery arrived",
                target="shelter", occupancy=occ, shelter_supplies=0))
    elif rec["shelter_supplies"] <= cfg.supplies_low_threshold and not rec["supplies_low_warned"]:
        rec["supplies_low_warned"] = True
        events.append(_ev(
            EventType.SHELTER_SUPPLIES_LOW, tick,
            f"Shelter supplies are running low: {rec['shelter_supplies']} units left.",
            f"{occ} people sheltered use {use} supply units per tick",
            target="shelter", occupancy=occ, shelter_supplies=rec["shelter_supplies"]))


def _recovery_tick(cfg, zones, shelters, rec, events, tick):
    occ = _occupancy(shelters)
    cap = sum(s.capacity for s in shelters.values() if s.is_open)
    crowded = cap > 0 and occ * 100 >= cap * cfg.disease_crowding_pct
    no_supplies = rec["shelter_supplies"] == 0 and occ > 0
    cw = rec["clean_water_active"]
    mc = rec["medical_camp_active"]

    prev = rec["disease_risk"]
    delta = (cfg.disease_rise_per_tick
             + (cfg.disease_crowding_rise if crowded else 0)
             + (cfg.disease_no_supplies_rise if no_supplies else 0)
             - (cfg.disease_clean_water_drop if cw else 0)
             - (cfg.disease_medical_camp_drop if mc else 0))
    risk = _clamp(prev + delta)
    rec["disease_risk"] = risk
    rec["peak_disease_risk"] = max(rec["peak_disease_risk"], risk)

    high = cfg.disease_high_threshold
    if prev < high <= risk:
        reasons = []
        if not cw:
            reasons.append("no clean water since recovery began")
        if crowded:
            reasons.append("a crowded shelter")
        if no_supplies:
            reasons.append("shelter supplies ran out")
        events.append(_ev(
            EventType.DISEASE_RISK_HIGH, tick,
            f"Waterborne disease risk rose to {risk} out of 100.",
            "Caused by " + (", ".join(reasons) if reasons else "standing floodwater"),
            target="health", disease_risk=risk))

    if risk >= high and not mc:
        new_cases = max(1, (risk - 50) // 10)
        rec["illness_cases"] += new_cases
        events.append(_ev(
            EventType.ILLNESS_REPORTED, tick,
            f"{new_cases} residents reported stomach illness linked to unsafe water.",
            f"Disease risk {risk} with no medical camp running",
            target="health", new_cases=new_cases, illness_cases=rec["illness_cases"], disease_risk=risk))

    if mc:
        treat = min(rec["illness_cases"] - rec["illness_treated"], cfg.treat_per_tick)
        if treat > 0:
            rec["illness_treated"] += treat
            events.append(_ev(
                EventType.ILLNESS_TREATED, tick,
                f"The medical camp treated {treat} residents.",
                "Medical camp running", target="medical_camp",
                treated=treat, illness_treated=rec["illness_treated"]))

    stranded = any(z.population_remaining > 0 and z.max_depth_cm > 0 for z in zones.values())
    trust_delta = ((-3 if no_supplies else 0) + (-2 if stranded else 0) + (-2 if risk >= high else 0)
                   + (1 if cw else 0) + (1 if mc else 0) + (1 if rec["power_on"] else 0))
    rec["community_trust"] = _clamp(rec["community_trust"] + trust_delta)
    # Contamination of wells and pipes falls slowly by itself, quickly with treatment.
    rec["water_contamination"] = _clamp(rec["water_contamination"] - (12 if cw else 2))


def _tag_phases(events: List[Event], start_phase: str, marks: List[Tuple[int, str]]) -> List[Event]:
    """Stamp every event with the phase in force when it happened (details.phase)."""
    tagged: List[Event] = []
    current = start_phase
    mark_iter = iter(marks)
    next_mark = next(mark_iter, None)
    for i, ev in enumerate(events):
        while next_mark is not None and i >= next_mark[0]:
            current = next_mark[1]
            next_mark = next(mark_iter, None)
        tagged.append(ev.model_copy(update={"details": {**ev.details, "phase": current}}))
    return tagged
