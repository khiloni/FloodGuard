from typing import Dict, Any, List
from ..engine.models import State


def generate_npc_message(npc_id: str, state: State, user_message: str = "") -> Dict[str, Any]:
    """Generate deterministic NPC response based on the character's role and current simulation state."""
    w1 = state.zones.get("ward-1")
    w2 = state.zones.get("ward-2")
    w3 = state.zones.get("ward-3")
    shelter = state.shelters.get("school")

    text = ""
    if state.phase == "recovery":
        text = _recovery_line(npc_id, state)
    elif npc_id == "village_head":
        if not shelter or not shelter.is_open:
            text = (
                f"We must unlock the High School shelter immediately. "
                f"Water is already at {state.water_level_cm} cm and families in Ward 1 are vulnerable."
            )
        elif w1 and w1.population_remaining > 0 and not w1.evacuation_ordered:
            text = (
                f"Ward 1 residents need clear direction. "
                f"Please issue an official evacuation order before the river surges higher."
            )
        else:
            total_safe = sum(z.safe_evacuated for z in state.zones.values())
            text = (
                f"Good progress. {total_safe} people have been escorted safely. "
                f"Let us keep vigil on the bund."
            )

    elif npc_id == "rescue_worker":
        if state.resources.available_boats > 0 and w1 and w1.water_depth_cm > 0:
            text = (
                f"Commander, we have {state.resources.available_boats} rescue boat(s) ready at the jetty. "
                f"Assign them to Ward 1 to evacuate families safely."
            )
        elif state.embankment.height_cm < 440 and state.resources.sandbags >= 100:
            text = (
                f"The river forecast is climbing. We should lay sandbags along the bund. "
                f"We have {state.resources.sandbags} sandbags available."
            )
        else:
            text = (
                f"Rescue teams are deployed. Roads into low-lying areas are hazardous. "
                f"We are prioritizing life safety."
            )

    elif npc_id == "family_member":
        if w1 and w1.water_depth_cm > 0 and w1.vulnerable_remaining > 0:
            text = (
                f"Water is seeping into our compound in Ward 1! "
                f"My elderly parents cannot wade through current. Please prioritize vulnerable transport!"
            )
        elif w1 and w1.safe_evacuated > 0 and w1.population_remaining == 0:
            text = "Thank you so much! Our family has reached the high ground shelter safely."
        else:
            text = (
                f"The water is swelling by the riverbank. We are packing essential documents "
                f"and waiting for transport instructions."
            )
    if not text:
        text = f"Officer stationed at post, awaiting operational orders for tick {state.tick}."

    return {
        "npc_id": npc_id,
        "text": text,
        "source": "template",
    }


def _recovery_line(npc_id: str, state: State) -> str:
    """Deterministic recovery-phase lines. Mentions only numbers that are in the state."""
    rec = state.recovery
    zones = state.zones
    stranded = [z for z in zones.values() if z.population_remaining > 0 and z.max_depth_cm > 0]
    blocked = [z for z in zones.values() if z.road_blocked]
    waiting = sum(z.safe_evacuated - z.returned for z in zones.values())
    if npc_id == "village_head":
        if stranded:
            return f"Families are still stranded in {stranded[0].name}. Send search and rescue teams before anything else."
        if waiting > 0 and any(z.surveyed or z.max_depth_cm == 0 for z in zones.values() if z.safe_evacuated > z.returned):
            return f"{waiting} people are still in the shelter. Where a ward is dry, surveyed and its road is open, we can bring them home."
        return f"The community is watching how we handle the recovery. Trust in the response stands at {rec.community_trust} out of 100."
    if npc_id == "rescue_worker":
        if blocked:
            return f"Debris blocks the road to {blocked[0].name}. Once the water is shallow my crews can clear it."
        if not rec.power_on:
            return "A road is open now, so the crews can reach the substation and restore power."
        return f"Roads and power are in order. We still have {rec.supply_deliveries_left} supply deliveries at the depot."
    if npc_id == "family_member":
        if not rec.clean_water_active:
            return f"People in the shelter are worried about the drinking water. The disease risk is {rec.disease_risk} out of 100."
        if rec.illness_cases > rec.illness_treated and not rec.medical_camp_active:
            return "Some neighbours have stomach illness. A medical camp would help them."
        return "The clean water point is helping. We just want to go home safely when our ward is ready."
    return ""
