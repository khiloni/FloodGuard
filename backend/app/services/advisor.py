"""Deterministic "What should I do?" advisor.

Lists every action that is valid right now, scores it with simple fixed heuristics, and returns
the best 2-3 of different kinds, each with a one-line trade-off made only from engine numbers
and a linked rule card. The LLM may rephrase the lines (validated, with these templates as the
fallback). Suggestions never execute by themselves: the player chooses and confirms.
"""
from typing import Any, Dict, List, Optional, Tuple

from ..engine import mechanics
from ..engine.models import Action, ActionName, State
from ..engine.rules import validate_action_preconditions

# Rule card for each action (see rulecards/en/rulecards.yaml)
ACTION_CARDS: Dict[str, str] = {
    "issue_warning": "RC-01", "order_evacuation": "RC-01", "prioritize_vulnerable": "RC-02",
    "assign_transport": "RC-03", "reinforce_embankment": "RC-04", "open_shelter": "RC-05",
    "provide_clean_water": "RC-06", "run_medical_camp": "RC-07", "damage_survey": "RC-08",
    "return_residents": "RC-08", "distribute_supplies": "RC-09", "clear_roads": "RC-10",
    "restore_power": "RC-10", "search_and_rescue": "RC-10", "clear_drains": "RC-11",
    "request_staggered_release": "RC-12", "recall_fishing_boats": "RC-13", "request_external_support": "RC-14",
}

# Which suggestions each NPC would make (by action name).
NPC_FOCUS: Dict[str, Tuple[str, ...]] = {
    "village_head": ("issue_warning", "order_evacuation", "open_shelter", "return_residents", "request_staggered_release"),
    "rescue_worker": ("assign_transport", "reinforce_embankment", "search_and_rescue", "clear_roads", "restore_power",
                      "clear_drains", "recall_fishing_boats"),
    "family_member": ("prioritize_vulnerable", "order_evacuation", "provide_clean_water", "return_residents"),
    "health_worker": ("prioritize_vulnerable", "provide_clean_water", "run_medical_camp", "distribute_supplies"),
    "district_official": ("request_external_support", "distribute_supplies", "damage_survey", "request_staggered_release"),
}


def _peak(state: State) -> int:
    return max(mechanics.water_level_at(state, t, state.mechanic_state) for t in range(1, len(state.forecast_cm) + 1))


def _candidates(state: State) -> List[Tuple[int, Action, str]]:
    """(score, action, trade-off) for every scoring rule that applies; invalid ones are dropped later."""
    out: List[Tuple[int, Action, str]] = []
    z_all = state.zones
    peak = _peak(state)
    res = state.resources
    rec = state.recovery
    occupancy = sum(s.current_occupancy for s in state.shelters.values())
    capacity_open = sum(s.capacity for s in state.shelters.values() if s.is_open)
    threatened = sorted((z for z in z_all.values() if z.elevation_cm < peak and z.population_remaining > 0),
                        key=lambda z: z.elevation_cm)
    ms = state.mechanic_state

    def add(score: int, name: str, tradeoff: str, **params: Any) -> None:
        out.append((score, Action(name=ActionName(name), params=params), tradeoff))

    if state.phase != "recovery":
        if state.mechanic.type == "cyclone" and ms.get("boats_at_sea", 0) > 0 and not ms.get("recalled"):
            add(99, "recall_fishing_boats",
                f"{ms['boats_at_sea']} boats need about {state.mechanic.params.get('return_ticks', 3)} ticks to return; "
                f"landfall is at tick {state.mechanic.params.get('landfall_tick')}.")
        if state.mechanic.type == "dam_release" and not ms.get("staggered"):
            add(93, "request_staggered_release",
                f"Lowers the extra water from the release at tick {state.mechanic.params.get('release_tick')} "
                "but keeps the river high for longer.")
        closed = [s for s in state.shelters.values() if not s.is_open]
        if closed and capacity_open < sum(z.population_remaining for z in threatened):
            s = max(closed, key=lambda sh: sh.capacity)
            add(100 if capacity_open == 0 else 74, "open_shelter",
                f"Gives {s.capacity} places; nobody can be evacuated until a shelter is open.", shelter_id=s.id)
        if state.first_warning_tick is None and threatened:
            add(96, "issue_warning", "Warned residents are far more willing to leave; it uses this turn only.")
        for z in threatened:
            if not z.evacuation_ordered:
                add(90 + (5 if z.water_depth_cm > 0 else 0) - z.elevation_cm // 100, "order_evacuation",
                    f"{z.population_remaining} people in {z.name}; the water is forecast to reach {peak} cm "
                    f"against ground at {z.elevation_cm} cm.", zone=z.id)
            if z.drain_blocked and state.mechanic.type == "drains" and ms.get("drain_crews", 0) > 0:
                add(88, "clear_drains", f"Reduces street water in {z.name}; {ms.get('drain_crews', 0)} crew(s) left.", zone=z.id)
            if z.water_depth_cm > 0 and res.available_boats > 0 and z.boats_assigned == 0:
                add(86, "assign_transport",
                    f"Boats carry {res.boat_capacity} each from {z.name}; they stay committed there.",
                    zone=z.id, transport_type="boat", count=res.available_boats)
            elif not z.road_flooded and res.available_vehicles > 0 and z.vehicles_assigned == 0 and z.evacuation_ordered:
                n = min(2, res.available_vehicles)
                add(82, "assign_transport",
                    f"{n} truck(s) carry {res.vehicle_capacity} each while the road is dry; they stop once it floods.",
                    zone=z.id, transport_type="vehicle", count=n)
            if z.vulnerable_remaining > 0 and z.evacuation_ordered and not z.prioritize_vulnerable:
                add(76, "prioritize_vulnerable",
                    f"{z.vulnerable_remaining} vulnerable residents in {z.name} move first; others wait a little longer.",
                    zone=z.id)
        if peak > state.embankment.height_cm and res.sandbags >= 100 and not state.embankment.breached \
                and state.embankment.height_cm < state.embankment_max_cm:
            bags = min(200, res.sandbags)
            add(80, "reinforce_embankment",
                f"Raises the bund by about {bags // 100 * 30} cm (forecast peak {peak} cm); {res.sandbags} sandbags in stock.",
                sandbags=bags)
    else:
        for z in z_all.values():
            if z.population_remaining > 0 and z.max_depth_cm > 0:
                add(100, "search_and_rescue", f"{z.population_remaining} people are stranded in {z.name}.", zone=z.id)
        if not rec.clean_water_active:
            add(95, "provide_clean_water",
                f"Disease risk is {rec.disease_risk} out of 100 and rises each tick without clean water.")
        if not rec.medical_camp_active:
            untreated = rec.illness_cases - rec.illness_treated
            add(85 + (10 if untreated else 0), "run_medical_camp",
                f"{untreated} people are ill now; the camp also slows the spread of disease.")
        for z in z_all.values():
            if z.road_blocked and z.water_depth_cm < state.recovery_config.road_debris_depth_cm:
                add(72, "clear_roads", f"Opens {z.name} for repair crews and for residents going home.", zone=z.id)
            if z.max_depth_cm > 0 and not z.surveyed and z.water_depth_cm == 0:
                add(66, "damage_survey", f"Families from {z.name} cannot return until houses are checked.", zone=z.id)
            if z.safe_evacuated - z.returned > 0 and z.water_depth_cm == 0 and not z.road_blocked \
                    and (z.surveyed or z.max_depth_cm == 0):
                add(70, "return_residents",
                    f"{z.safe_evacuated - z.returned} people from {z.name} can go home, easing the crowded shelter.", zone=z.id)
        if not rec.power_on:
            add(74, "restore_power", "Brings the health centre and water pumps back; needs one cleared road.")
    if occupancy > 0 and rec.supply_deliveries_left > 0 and rec.shelter_supplies <= state.recovery_config.supplies_low_threshold * 2:
        add(84, "distribute_supplies",
            f"Shelter stock is {rec.shelter_supplies} units for {occupancy} people; {rec.supply_deliveries_left} deliveries left.")
    if state.support_requests_left > 0 and state.support_eta_tick is None and state.support.uses > 0:
        add(60, "request_external_support",
            f"Boats, trucks and relief arrive after {state.support.delay_ticks} ticks; it can be requested only once.")
    return out


def suggest(state: State, limit: int = 3, focus: Optional[Tuple[str, ...]] = None) -> List[Dict[str, Any]]:
    """Top valid suggestions, at most one per action type, highest score first (ties by name)."""
    if state.is_finished:
        return []
    ranked = sorted(_candidates(state), key=lambda c: (-c[0], c[1].name.value, sorted(c[1].params.items())))
    picked: List[Dict[str, Any]] = []
    seen = set()
    for score, action, tradeoff in ranked:
        if action.name.value in seen or (focus and action.name.value not in focus):
            continue
        if not validate_action_preconditions(state, action)[0]:
            continue
        seen.add(action.name.value)
        picked.append({"action": action.model_dump(mode="json"), "priority": score, "tradeoff": tradeoff,
                       "rule_card_id": ACTION_CARDS.get(action.name.value)})
        if len(picked) >= limit:
            break
    if not picked and not focus:
        picked.append({"action": Action(name=ActionName.WAIT, params={}).model_dump(mode="json"), "priority": 1,
                       "tradeoff": "Nothing urgent is possible right now; waiting lets time pass.", "rule_card_id": None})
    return picked


def npc_suggestion(state: State, npc_id: str) -> Optional[Dict[str, Any]]:
    """One suggestion that fits this NPC's role, or None. Never executed automatically."""
    focus = NPC_FOCUS.get(npc_id)
    if not focus:
        return None
    found = suggest(state, limit=1, focus=focus)
    return found[0] if found else None
