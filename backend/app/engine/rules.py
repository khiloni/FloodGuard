from typing import Tuple, Optional
from .models import State, Action, ActionName


def validate_action_preconditions(state: State, action: Action) -> Tuple[bool, Optional[str]]:
    """Validate whether an action can legally be performed given the current state.
    Returns (is_valid, reject_reason). If valid, reject_reason is None.
    """
    if state.is_finished:
        return False, "Simulation has already concluded."

    name = action.name
    params = action.params

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
        valid_npcs = ["village_head", "rescue_worker", "family_member"]
        if not npc_id or npc_id not in valid_npcs:
            return False, f"Unknown character '{npc_id}'. Valid NPCs: {valid_npcs}."
        return True, None

    return False, f"Unsupported action '{name}'."
