from typing import List, Dict, Any, Set
from ..engine.models import State, Event, EventType
from ..guardrail.validator import GuardrailValidator


def generate_template_narration(state: State, events: List[Event]) -> str:
    """Generate deterministic, narrative summary describing turn events."""
    if not events:
        return f"Tick {state.tick}: The river remains at {state.water_level_cm} cm. Preparedness teams hold station."

    narrative_lines: List[str] = []

    for event in events:
        if event.type == EventType.WARNING_ISSUED:
            narrative_lines.append(f"Sirens and loudspeaker broadcasts echoed across the riverbank. {event.description}")
        elif event.type == EventType.EVACUATION_ORDERED:
            narrative_lines.append(f"Civil authorities activated evacuation protocols: {event.description}")
        elif event.type == EventType.TRANSPORT_ASSIGNED:
            narrative_lines.append(f"Logistics update: {event.description}")
        elif event.type == EventType.SHELTER_OPENED:
            narrative_lines.append(f"Relief infrastructure online: {event.description}")
        elif event.type == EventType.EMBANKMENT_REINFORCED:
            narrative_lines.append(f"Defensive engineering: {event.description}")
        elif event.type == EventType.WATER_LEVEL_ADVANCED:
            narrative_lines.append(f"Hydrology monitor: Water level rose to {event.details.get('water_level_cm', state.water_level_cm)} cm.")
        elif event.type == EventType.ROAD_INUNDATED:
            narrative_lines.append(f"URGENT: {event.description}")
        elif event.type == EventType.ZONE_FLOODED:
            narrative_lines.append(f"FLOOD WARNING: {event.description}")
        elif event.type == EventType.EMBANKMENT_OVERFLOW:
            narrative_lines.append(f"HAZARD: {event.description}")
        elif event.type == EventType.EMBANKMENT_BREACHED:
            narrative_lines.append(f"CRITICAL BREACH: {event.description}")
        elif event.type == EventType.RESIDENTS_EVACUATED:
            narrative_lines.append(f"Evacuation progress: {event.description}")
        elif event.type == EventType.VULNERABLE_EVACUATED:
            narrative_lines.append(f"Priority evacuation: {event.description}")
        elif event.type == EventType.CASUALTY_OCCURRED:
            narrative_lines.append(f"CASUALTIES REPORTED: {event.description}")
        elif event.type == EventType.SESSION_COMPLETED:
            narrative_lines.append(f"Final Outcome: {event.description}")

    if not narrative_lines:
        return f"Tick {state.tick}: River height recorded at {state.water_level_cm} cm."

    return " ".join(narrative_lines)


def get_facts_allowed_from_state_and_events(state: State, events: List[Event]) -> Set[int]:
    """Collect all valid numerical figures from the simulation state and events."""
    facts: Set[int] = {
        state.tick,
        state.max_ticks,
        state.water_level_cm,
        state.embankment.height_cm,
        state.embankment.integrity,
        state.resources.total_boats,
        state.resources.available_boats,
        state.resources.boat_capacity,
        state.resources.total_vehicles,
        state.resources.available_vehicles,
        state.resources.vehicle_capacity,
        state.resources.sandbags,
    }
    # Common conversational quantities and percentage bases
    facts.update({0, 1, 2, 3, 4, 5, 10, 15, 20, 24, 25, 30, 40, 50, 100, 112, 1078})

    for z in state.zones.values():
        facts.update({
            z.elevation_cm,
            z.initial_population,
            z.population_remaining,
            z.initial_vulnerable,
            z.vulnerable_remaining,
            z.safe_evacuated,
            z.vulnerable_saved,
            z.water_depth_cm,
            z.lost,
            z.boats_assigned,
            z.vehicles_assigned,
        })
    facts.add(sum(z.safe_evacuated for z in state.zones.values()))

    for s in state.shelters.values():
        facts.update({s.capacity, s.current_occupancy, s.elevation_cm})

    for e in events:
        for val in e.details.values():
            if isinstance(val, int):
                facts.add(val)

    if state.score:
        facts.add(state.score.total_score)

    return facts
