import random
import pytest
from backend.app.engine.loader import load_scenario
from backend.app.engine.step import step
from backend.app.engine.models import Action, ActionName
from backend.app.engine.rules import validate_action_preconditions


def test_simulation_invariants():
    """Verify all mathematical and conservation invariants over 50 randomized action sequences."""
    scenario_path = "scenarios/village-river-01.yaml"
    possible_actions = [
        Action(name=ActionName.WAIT, params={}),
        Action(name=ActionName.ISSUE_WARNING, params={}),
        Action(name=ActionName.OPEN_SHELTER, params={"shelter_id": "school"}),
        Action(name=ActionName.ORDER_EVACUATION, params={"zone": "ward-1"}),
        Action(name=ActionName.ORDER_EVACUATION, params={"zone": "ward-2"}),
        Action(name=ActionName.ASSIGN_TRANSPORT, params={"zone": "ward-1", "transport_type": "boat", "count": 1}),
        Action(name=ActionName.PRIORITIZE_VULNERABLE, params={"zone": "ward-1"}),
        Action(name=ActionName.REINFORCE_EMBANKMENT, params={"sandbags": 100}),
    ]

    for seed in range(50):
        state = load_scenario(scenario_path)
        rng = random.Random(seed)
        
        while not state.is_finished and state.tick < state.max_ticks:
            action = rng.choice(possible_actions)
            valid, _ = validate_action_preconditions(state, action)
            if not valid:
                action = Action(name=ActionName.WAIT, params={})

            prev_tick = state.tick
            state, events = step(state, action, rng)

            # Invariant 1: Tick advances by exactly 1
            assert state.tick == prev_tick + 1

            # Invariant 2: Population conservation for every zone
            for zid, zone in state.zones.items():
                total_in_zone = (
                    zone.safe_evacuated
                    + zone.in_transit
                    + zone.population_remaining
                    + zone.lost
                )
                assert total_in_zone == zone.initial_population, (
                    f"Population conservation violated in {zid}: "
                    f"{total_in_zone} != {zone.initial_population} at tick {state.tick}"
                )
                assert zone.population_remaining >= 0
                assert zone.vulnerable_remaining >= 0
                assert zone.safe_evacuated >= 0
                assert zone.lost >= 0

            # Invariant 3: Resources are never negative
            assert state.resources.available_boats >= 0
            assert state.resources.available_vehicles >= 0
            assert state.resources.sandbags >= 0

            # Invariant 4: Shelter occupancy never exceeds capacity
            for sid, shelter in state.shelters.items():
                assert shelter.current_occupancy <= shelter.capacity, (
                    f"Shelter {sid} overcapacity: {shelter.current_occupancy} > {shelter.capacity}"
                )

            # Invariant 5: Water level strictly equals forecast curve
            expected_water = state.forecast_cm[min(state.tick - 1, len(state.forecast_cm) - 1)]
            assert state.water_level_cm == expected_water

            # Invariant 6: Score bounded in 0-100 when finished
            if state.is_finished:
                assert state.score is not None
                assert 0 <= state.score.total_score <= 100
                sum_weights = (
                    state.score.residents_safe_score
                    + state.score.vulnerable_protected_score
                    + state.score.response_time_score
                    + state.score.resource_efficiency_score
                    + state.score.infrastructure_preserved_score
                )
                assert state.score.total_score == sum_weights
