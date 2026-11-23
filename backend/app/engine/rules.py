from typing import Tuple, Optional
from .models import State, Action, ActionName, FLOOD_ONLY_ACTIONS, RECOVERY_ONLY_ACTIONS, MECHANIC_ACTIONS
from . import mechanics


def validate_action_preconditions(state: State, action: Action) -> Tuple[bool, Optional[str]]:
    """Validate whether an action can legally be performed given the current state.
    Returns (is_valid, reject_reason). If valid, reject_reason is None.
    """
    if state.is_finished:
        return False, "Simulation has already concluded."

    name = action.name
    params = action.params

    # Phase gating (Part 2). Only applies to scenarios with a recovery phase.
    if state.recovery_config.enabled:
        if state.phase == "recovery" and name in FLOOD_ONLY_ACTIONS:
            return False, ("The flood response phase is over; the water is receding. "
                           "Use recovery actions such as search and rescue, clean water or clearing roads.")
        if state.phase != "recovery" and name in RECOVERY_ONLY_ACTIONS:
            return False, ("Recovery actions become available once the floodwater recedes "
                           "below the danger level after the peak.")
    elif name in RECOVERY_ONLY_ACTIONS or name == ActionName.DISTRIBUTE_SUPPLIES:
        return False, "This scenario has no recovery phase."

    if name in RECOVERY_ONLY_ACTIONS or name == ActionName.DISTRIBUTE_SUPPLIES:
        return _validate_recovery_action(state, action)

    if name == ActionName.REQUEST_EXTERNAL_SUPPORT:
        reason = mechanics.validate_support_request(state)
        return (reason is None), reason

    if name in MECHANIC_ACTIONS:
        if state.mechanic.type != MECHANIC_ACTIONS[name]:
            return False, "That order does not apply in this scenario."
        reason = mechanics.validate_mechanic_action(state, action)
        return (reason is None), reason

    if name == ActionName.WAIT:
        return True, None

    elif name == ActionName.ISSUE_WARNING:
        zone_id = params.get("zone")
        if zone_id and zone_id not in state.zones:
            return False, f"Unknown zone: '{zone_id}'."
        return True, None

    elif name == ActionName.ORDER_EVACUATION:
        zone_id = params.get("zone")
        if not zone_id:
            return False, "Target zone is required for evacuation order."
        if zone_id not in state.zones:
            return False, f"Unknown zone: '{zone_id}'."
        zone = state.zones[zone_id]
        if zone.population_remaining <= 0:
            return False, f"Zone '{zone.name}' has no remaining population to evacuate."
        return True, None

    elif name == ActionName.ASSIGN_TRANSPORT:
        zone_id = params.get("zone")
        transport_type = params.get("transport_type")
        count = int(params.get("count", 1))

        if not zone_id or zone_id not in state.zones:
            return False, f"Valid target zone is required. Known zones: {list(state.zones.keys())}."
        if count <= 0:
            return False, "Transport count must be at least 1."

        zone = state.zones[zone_id]
        if zone.population_remaining <= 0:
            return False, f"Zone '{zone.name}' has no residents awaiting transport."

        if transport_type == "boat":
            if state.resources.available_boats < count:
                return False, f"Insufficient boats available. Requested {count}, available {state.resources.available_boats}."
        elif transport_type == "vehicle":
            if zone.road_flooded:
                return False, f"Road to {zone.name} is submerged. Wheeled vehicles cannot safely traverse."
            if state.resources.available_vehicles < count:
                return False, f"Insufficient vehicles available. Requested {count}, available {state.resources.available_vehicles}."
        else:
            return False, "transport_type must be 'boat' or 'vehicle'."

        return True, None

    elif name == ActionName.PRIORITIZE_VULNERABLE:
        zone_id = params.get("zone")
        if not zone_id or zone_id not in state.zones:
            return False, f"Valid target zone is required. Known zones: {list(state.zones.keys())}."
        zone = state.zones[zone_id]
        if zone.vulnerable_remaining <= 0:
            return False, f"Zone '{zone.name}' has no vulnerable individuals awaiting evacuation."
        return True, None

    elif name == ActionName.OPEN_SHELTER:
        shelter_id = params.get("shelter_id")
        if not shelter_id or shelter_id not in state.shelters:
            return False, f"Valid shelter is required. Known shelters: {list(state.shelters.keys())}."
        shelter = state.shelters[shelter_id]
        if shelter.is_open:
            return False, f"Shelter '{shelter.name}' is already open and receiving evacuees."
        return True, None

    elif name == ActionName.REINFORCE_EMBANKMENT:
        sandbags = int(params.get("sandbags", 100))
        if sandbags <= 0:
            return False, "Sandbag count must be greater than zero."
        if state.resources.sandbags < sandbags:
            return False, f"Insufficient sandbags. Requested {sandbags}, available {state.resources.sandbags}."
        if state.embankment.breached:
            return False, "Embankment has already suffered a catastrophic breach. Sandbags cannot contain this flood volume."
        return True, None

    elif name == ActionName.CONSULT_NPC:
        npc_id = params.get("npc_id")
        valid_npcs = list(state.npc_ids)
        if not npc_id or npc_id not in valid_npcs:
            return False, f"Unknown character '{npc_id}'. Valid NPCs: {valid_npcs}."
        return True, None

    return False, f"Unsupported action '{name}'."


def _zone_or_error(state: State, params) -> Tuple[Optional[str], Optional[str]]:
    zone_id = params.get("zone")
    if not zone_id or zone_id not in state.zones:
        return None, f"Valid target zone is required. Known zones: {list(state.zones.keys())}."
    return zone_id, None


def _shelter_space(state: State) -> int:
    return sum(s.capacity - s.current_occupancy for s in state.shelters.values() if s.is_open)


def _validate_recovery_action(state: State, action: Action) -> Tuple[bool, Optional[str]]:
    name = action.name
    params = action.params
    rec = state.recovery
    cfg = state.recovery_config

    if name == ActionName.DISTRIBUTE_SUPPLIES:
        if not any(s.is_open for s in state.shelters.values()):
            return False, "No shelter is open to receive supplies."
        sid = params.get("shelter_id")
        if sid is not None and (sid not in state.shelters or not state.shelters[sid].is_open):
            return False, f"Shelter '{sid}' is not open."
        if rec.supply_deliveries_left <= 0:
            return False, "No supply deliveries are left at the depot."
        return True, None

    if name == ActionName.PROVIDE_CLEAN_WATER:
        if rec.clean_water_active:
            return False, "Clean water is already being provided."
        if rec.clean_water_kits <= 0:
            return False, "No water purification kits are left."
        return True, None

    if name == ActionName.RUN_MEDICAL_CAMP:
        if rec.medical_camp_active:
            return False, "The medical camp is already running."
        if rec.medical_teams <= 0:
            return False, "No medical teams are available."
        return True, None

    if name == ActionName.RESTORE_POWER:
        if rec.power_on:
            return False, "Power is already on."
        blocked_ever = [z for z in state.zones.values() if z.max_depth_cm >= cfg.road_debris_depth_cm]
        if blocked_ever and all(z.road_blocked for z in blocked_ever):
            return False, "Repair crews cannot reach the substation yet. Clear at least one road first."
        return True, None

    zone_id, err = _zone_or_error(state, params)
    if err:
        return False, err
    zone = state.zones[zone_id]

    if name == ActionName.SEARCH_AND_RESCUE:
        if zone.population_remaining <= 0:
            return False, f"No stranded residents remain in {zone.name}."
        if zone.max_depth_cm <= 0:
            return False, f"{zone.name} stayed dry; its residents are safe at home and need no rescue."
        if _shelter_space(state) <= 0:
            return False, "No open shelter has space for rescued residents. Open the shelter first."
        return True, None

    if name == ActionName.CLEAR_ROADS:
        if not zone.road_blocked:
            return False, f"The road to {zone.name} is not blocked."
        if zone.water_depth_cm >= cfg.road_debris_depth_cm:
            return False, f"The road to {zone.name} is still under {zone.water_depth_cm} cm of water."
        return True, None

    if name == ActionName.DAMAGE_SURVEY:
        if zone.max_depth_cm <= 0:
            return False, f"{zone.name} was not flooded; no damage survey is needed."
        if zone.surveyed:
            return False, f"{zone.name} has already been surveyed."
        return True, None

    if name == ActionName.RETURN_RESIDENTS:
        if zone.safe_evacuated - zone.returned <= 0:
            return False, f"No residents from {zone.name} are waiting in the shelter."
        if zone.water_depth_cm > 0:
            return False, f"{zone.name} is still under {zone.water_depth_cm} cm of water."
        if zone.road_blocked:
            return False, f"The road to {zone.name} is blocked by debris. Clear it first."
        if zone.max_depth_cm > 0 and not zone.surveyed:
            return False, f"{zone.name} must have a damage survey before residents return."
        return True, None

    return False, f"Unsupported action '{name}'."
