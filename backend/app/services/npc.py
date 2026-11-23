"""Deterministic NPC lines and per-NPC fact limits (works for every scenario pack).

Each NPC only "knows" facts that fit their role: a resident knows their own ward, the health
worker knows health and shelter numbers, the district official knows resources and outside
support. The same limits are applied to the LLM's allowed numbers in the turn pipeline.
"""
from typing import Any, Dict, List, Optional, Set

from ..engine.models import Event, State

COMMON_NUMBERS = {0, 1, 2, 3, 4, 5, 10, 112, 1078}


def _lowest_zone(state: State):
    return min(state.zones.values(), key=lambda z: z.elevation_cm) if state.zones else None


def _closed_shelter(state: State):
    for s in state.shelters.values():
        if not s.is_open:
            return s
    return None


def _home_zone(state: State, location: Optional[str]):
    if location and location in state.zones:
        return state.zones[location]
    return _lowest_zone(state)


def generate_npc_message(npc_id: str, state: State, user_message: str = "",
                         location: Optional[str] = None) -> Dict[str, Any]:
    """Generate a deterministic NPC response from the character's role and the current state."""
    if state.phase == "recovery":
        text = _recovery_line(npc_id, state, location)
    else:
        text = _flood_line(npc_id, state, location)
    if not text:
        text = f"I am at my post and waiting for your orders for tick {state.tick}."
    return {"npc_id": npc_id, "text": text, "source": "template"}


def _flood_line(npc_id: str, state: State, location: Optional[str]) -> str:
    low = _lowest_zone(state)
    home = _home_zone(state, location)
    closed = _closed_shelter(state)
    res = state.resources
    if npc_id == "village_head":
        if closed is not None and not any(s.is_open for s in state.shelters.values()):
            return (f"We must open {closed.name} now. The water is already at {state.water_level_cm} cm "
                    f"and families in {low.name} are exposed.")
        if low and low.population_remaining > 0 and not low.evacuation_ordered:
            return f"{low.name} needs clear direction. Please order an evacuation before the water rises further."
        total_safe = sum(z.safe_evacuated for z in state.zones.values())
        return f"Good progress: {total_safe} people have reached safety. Let us keep watch on the water."
    if npc_id == "rescue_worker":
        if res.available_boats > 0 and low and low.water_depth_cm > 0:
            return (f"We have {res.available_boats} boat(s) ready. Send them to {low.name}, "
                    "where trucks can no longer get through.")
        if state.embankment.height_cm < state.embankment_max_cm and res.sandbags >= 100 and not state.embankment.breached:
            return f"The water is still climbing. We should lay sandbags; we have {res.sandbags} ready."
        if res.available_vehicles > 0:
            return f"{res.available_vehicles} truck(s) are free while the roads are still open."
        return "All our teams are deployed. Roads into low areas are dangerous now."
    if npc_id == "family_member":
        if home and home.water_depth_cm > 0 and home.vulnerable_remaining > 0:
            return (f"Water is coming into our homes in {home.name}. The elderly people here cannot walk "
                    "through it. Please send help for them first.")
        if home and home.safe_evacuated > 0 and home.population_remaining == 0:
            return "Thank you. Our family reached the shelter safely."
        return "We are packing our documents and waiting for instructions."
    if npc_id == "health_worker":
        occ = sum(s.current_occupancy for s in state.shelters.values())
        if occ > 0:
            return (f"{occ} people are in shelters now. We need enough food and clean water there, "
                    "and the vulnerable must be checked first.")
        vuln = sum(z.vulnerable_remaining for z in state.zones.values())
        return f"{vuln} vulnerable residents are still at home. They should be moved early, before roads close."
    if npc_id == "district_official":
        if state.support_requests_left > 0 and state.support_eta_tick is None and state.support.uses > 0:
            return (f"I can send a convoy with boats, trucks and relief. It takes {state.support.delay_ticks} "
                    "ticks to arrive, so ask early.")
        if state.support_eta_tick is not None:
            return f"The convoy is on its way and should arrive at tick {state.support_eta_tick}."
        return "We have sent everything we can. Use the resources wisely."
    return ""


def _recovery_line(npc_id: str, state: State, location: Optional[str]) -> str:
    """Recovery-phase lines. Mentions only numbers that are in the state."""
    rec = state.recovery
    zones = state.zones
    stranded = [z for z in zones.values() if z.population_remaining > 0 and z.max_depth_cm > 0]
    blocked = [z for z in zones.values() if z.road_blocked]
    waiting = sum(z.safe_evacuated - z.returned for z in zones.values())
    if npc_id == "village_head":
        if stranded:
            return f"Families are still stranded in {stranded[0].name}. Send search and rescue teams before anything else."
        if waiting > 0:
            return (f"{waiting} people are still in the shelter. Where an area is dry, surveyed and its road "
                    "is open, we can bring them home.")
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
        return "The clean water point is helping. We just want to go home safely when our area is ready."
    if npc_id == "health_worker":
        if not rec.clean_water_active:
            return f"Wells and pipes are contaminated. Disease risk is {rec.disease_risk} out of 100; clean water comes first."
        if not rec.medical_camp_active:
            return f"{rec.illness_cases - rec.illness_treated} people have untreated illness. A medical camp would let us treat them."
        return f"Disease risk is down to {rec.disease_risk}. Keep the water point and the camp running."
    if npc_id == "district_official":
        damaged = sum(z.damaged_houses for z in zones.values() if z.surveyed)
        unsurveyed = [z for z in zones.values() if z.max_depth_cm > 0 and not z.surveyed]
        if unsurveyed:
            return f"Survey {unsurveyed[0].name} before anyone returns. We need the damage figures for compensation."
        return f"Surveys show {damaged} damaged houses so far. Relief deliveries left: {rec.supply_deliveries_left}."
    return ""


def allowed_facts_for_npc(npc_id: str, state: State, events: List[Event], base: Set[int],
                          location: Optional[str] = None) -> Set[int]:
    """Numbers this NPC may mention (a subset of `base`, the turn's allowed facts)."""
    if npc_id in ("village_head", "rescue_worker"):
        return set(base)
    facts: Set[int] = set(COMMON_NUMBERS) | {state.tick, state.max_ticks, state.water_level_cm}
    for e in events:
        for v in e.details.values():
            if isinstance(v, int) and not isinstance(v, bool):
                facts.add(v)
    rec = state.recovery
    shelters = {s.current_occupancy for s in state.shelters.values()} | {s.capacity for s in state.shelters.values()}
    occ = sum(s.current_occupancy for s in state.shelters.values())
    if npc_id == "family_member":
        z = _home_zone(state, location)
        if z is not None:
            facts |= {z.population_remaining, z.vulnerable_remaining, z.water_depth_cm, z.safe_evacuated, z.returned}
        facts |= {rec.disease_risk}
    elif npc_id == "health_worker":
        facts |= shelters | {occ, rec.disease_risk, rec.peak_disease_risk, rec.illness_cases, rec.illness_treated,
                             rec.illness_cases - rec.illness_treated, rec.water_contamination}
        facts |= {sum(z.vulnerable_remaining for z in state.zones.values())}
    elif npc_id == "district_official":
        r = state.resources
        facts |= shelters | {occ, r.total_boats, r.available_boats, r.total_vehicles, r.available_vehicles, r.sandbags,
                             rec.supply_deliveries_left, rec.shelter_supplies, state.support.delay_ticks,
                             state.support_eta_tick or 0}
        facts |= {z.damaged_houses for z in state.zones.values()} | {sum(z.damaged_houses for z in state.zones.values())}
    return facts
