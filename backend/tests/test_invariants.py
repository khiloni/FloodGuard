import glob
import os
import random

import pytest

from backend.app.engine.loader import load_scenario
from backend.app.engine.step import step
from backend.app.engine.models import Action, ActionName, PHASES
from backend.app.engine.rules import validate_action_preconditions
from backend.app.engine.scoring import WEIGHTS
from backend.app.engine import mechanics

SCENARIO = "scenarios/village-river-01.yaml"
PACKS = sorted(glob.glob("scenarios/*.yaml"))


def actions_for(state):
    """Every action type with parameters valid for this pack's zones, shelters and NPCs."""
    zones = list(state.zones)
    acts = [Action(name=ActionName.WAIT, params={}), Action(name=ActionName.ISSUE_WARNING, params={}),
            Action(name=ActionName.REINFORCE_EMBANKMENT, params={"sandbags": 100}),
            Action(name=ActionName.DISTRIBUTE_SUPPLIES, params={}), Action(name=ActionName.PROVIDE_CLEAN_WATER, params={}),
            Action(name=ActionName.RUN_MEDICAL_CAMP, params={}), Action(name=ActionName.RESTORE_POWER, params={}),
            Action(name=ActionName.REQUEST_EXTERNAL_SUPPORT, params={}),
            Action(name=ActionName.REQUEST_STAGGERED_RELEASE, params={}),
            Action(name=ActionName.RECALL_FISHING_BOATS, params={})]
    acts += [Action(name=ActionName.OPEN_SHELTER, params={"shelter_id": sid}) for sid in state.shelters]
    acts += [Action(name=ActionName.CONSULT_NPC, params={"npc_id": n}) for n in state.npc_ids]
    for z in zones:
        acts += [Action(name=n, params={"zone": z}) for n in (
            ActionName.ORDER_EVACUATION, ActionName.PRIORITIZE_VULNERABLE, ActionName.SEARCH_AND_RESCUE,
            ActionName.CLEAR_ROADS, ActionName.DAMAGE_SURVEY, ActionName.RETURN_RESIDENTS, ActionName.CLEAR_DRAINS)]
        acts += [Action(name=ActionName.ASSIGN_TRANSPORT, params={"zone": z, "transport_type": t, "count": 1})
                 for t in ("boat", "vehicle")]
    return acts

POSSIBLE_ACTIONS = [
    Action(name=ActionName.WAIT, params={}),
    Action(name=ActionName.ISSUE_WARNING, params={}),
    Action(name=ActionName.OPEN_SHELTER, params={"shelter_id": "school"}),
    Action(name=ActionName.ORDER_EVACUATION, params={"zone": "ward-1"}),
    Action(name=ActionName.ORDER_EVACUATION, params={"zone": "ward-2"}),
    Action(name=ActionName.ASSIGN_TRANSPORT, params={"zone": "ward-1", "transport_type": "boat", "count": 1}),
    Action(name=ActionName.ASSIGN_TRANSPORT, params={"zone": "ward-2", "transport_type": "vehicle", "count": 1}),
    Action(name=ActionName.PRIORITIZE_VULNERABLE, params={"zone": "ward-1"}),
    Action(name=ActionName.REINFORCE_EMBANKMENT, params={"sandbags": 100}),
    Action(name=ActionName.CONSULT_NPC, params={"npc_id": "village_head"}),
    # Recovery actions (Part 2)
    Action(name=ActionName.DISTRIBUTE_SUPPLIES, params={}),
    Action(name=ActionName.PROVIDE_CLEAN_WATER, params={}),
    Action(name=ActionName.RUN_MEDICAL_CAMP, params={}),
    Action(name=ActionName.RESTORE_POWER, params={}),
] + [
    Action(name=n, params={"zone": z})
    for n in (ActionName.SEARCH_AND_RESCUE, ActionName.CLEAR_ROADS,
              ActionName.DAMAGE_SURVEY, ActionName.RETURN_RESIDENTS)
    for z in ("ward-1", "ward-2", "ward-3")
]

SCORE_FIELDS = {
    "residents_safe": "residents_safe_score",
    "vulnerable_protected": "vulnerable_protected_score",
    "response_time": "response_time_score",
    "resource_efficiency": "resource_efficiency_score",
    "infrastructure_preserved": "infrastructure_preserved_score",
    "public_health": "public_health_score",
    "essential_services": "essential_services_score",
    "safe_return": "safe_return_score",
    "community_trust": "community_trust_score",
}


def _assert_no_floats(obj, path="state"):
    if isinstance(obj, float):
        raise AssertionError(f"Float found in engine state at {path}: {obj}")
    if isinstance(obj, dict):
        for k, v in obj.items():
            _assert_no_floats(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _assert_no_floats(v, f"{path}[{i}]")


def test_weights_sum_to_100():
    assert sum(WEIGHTS.values()) == 100


@pytest.mark.parametrize("scenario", PACKS, ids=lambda p: os.path.basename(p)[:-5])
def test_simulation_invariants(scenario):
    """Conservation and bounds over 40 random action sequences per pack, covering all three phases."""
    for seed in range(40):
        state = load_scenario(scenario, ("easy", "standard", "hard")[seed % 3])
        rng = random.Random(seed)
        phases_seen = [state.phase]
        possible = POSSIBLE_ACTIONS if scenario.endswith("village-river-01.yaml") and seed % 2 else actions_for(state)

        while not state.is_finished:
            action = rng.choice(possible)
            valid, _ = validate_action_preconditions(state, action)
            if not valid:
                action = Action(name=ActionName.WAIT, params={})

            prev_tick = state.tick
            state, events = step(state, action, rng)

            # 1. Tick advances by exactly 1
            assert state.tick == prev_tick + 1

            # 2. Population conservation and recovery bookkeeping per zone
            for zid, zone in state.zones.items():
                total = zone.safe_evacuated + zone.in_transit + zone.population_remaining + zone.lost
                assert total == zone.initial_population, f"conservation broken in {zid} at tick {state.tick}"
                assert min(zone.population_remaining, zone.vulnerable_remaining,
                           zone.safe_evacuated, zone.lost, zone.returned) >= 0
                assert zone.returned <= zone.safe_evacuated
                assert zone.max_depth_cm >= zone.water_depth_cm

            # 3. Resources never negative
            assert state.resources.available_boats >= 0
            assert state.resources.available_vehicles >= 0
            assert state.resources.sandbags >= 0

            # 4. Shelter: within capacity and equal to everyone sheltered and not yet home
            occ = sum(s.current_occupancy for s in state.shelters.values())
            for sid, shelter in state.shelters.items():
                assert 0 <= shelter.current_occupancy <= shelter.capacity, sid
            assert occ == sum(z.safe_evacuated - z.returned for z in state.zones.values())

            # 5. Water follows the forecast curve (plus any scheduled dam release)
            assert state.water_level_cm == mechanics.water_level_at(state, state.tick, state.mechanic_state)
            if state.mechanic.type != "dam_release":
                assert state.water_level_cm == state.forecast_cm[min(state.tick - 1, len(state.forecast_cm) - 1)]
            # 5b. Resources and mechanic counters never negative
            assert state.support_requests_left >= 0
            assert all(v >= 0 for v in state.mechanic_state.values())

            # 6. Recovery state bounds
            rec = state.recovery
            assert 0 <= rec.disease_risk <= 100 and rec.disease_risk <= rec.peak_disease_risk <= 100
            assert 0 <= rec.community_trust <= 100
            assert rec.shelter_supplies >= 0 and rec.supply_deliveries_left >= 0
            assert rec.clean_water_kits >= 0 and rec.medical_teams >= 0
            assert 0 <= rec.illness_treated <= rec.illness_cases

            # 7. Phase is valid and monotonic; every event is tagged with a phase
            assert state.phase in PHASES
            if state.phase != phases_seen[-1]:
                assert PHASES.index(state.phase) > PHASES.index(phases_seen[-1])
                phases_seen.append(state.phase)
            for ev in events:
                assert ev.details.get("phase") in PHASES
                assert ev.caused_by

            # 8. Integer-only engine state
            _assert_no_floats(state.model_dump())

        # 9. Final score: components within their weights and summing to the total
        assert state.score is not None
        assert 0 <= state.score.total_score <= 100
        parts = 0
        for key, field in SCORE_FIELDS.items():
            val = getattr(state.score, field)
            assert 0 <= val <= WEIGHTS[key], f"{field}={val}"
            parts += val
        assert state.score.total_score == parts
        assert phases_seen == list(PHASES), f"seed {seed} saw {phases_seen}"
