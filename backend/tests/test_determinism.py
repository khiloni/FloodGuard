import random
import hashlib
import json
import pytest
from backend.app.engine.loader import load_scenario
from backend.app.engine.step import step
from backend.app.engine.models import Action, ActionName


def test_determinism_identical_runs():
    """Run the same scenario, seed and action list 100 times: must produce identical state hash every time."""
    scenario_path = "scenarios/village-river-01.yaml"
    actions = [
        Action(name=ActionName.OPEN_SHELTER, params={"shelter_id": "school"}),
        Action(name=ActionName.ISSUE_WARNING, params={"zone": "ward-1"}),
        Action(name=ActionName.ORDER_EVACUATION, params={"zone": "ward-1"}),
        Action(name=ActionName.ASSIGN_TRANSPORT, params={"zone": "ward-1", "transport_type": "boat", "count": 2}),
        Action(name=ActionName.PRIORITIZE_VULNERABLE, params={"zone": "ward-1"}),
        Action(name=ActionName.REINFORCE_EMBANKMENT, params={"sandbags": 100}),
        Action(name=ActionName.WAIT, params={}),
    ]

    hashes = set()
    for _ in range(100):
        state = load_scenario(scenario_path)
        rng = random.Random(42)
        for act in actions:
            state, _ = step(state, act, rng)
        state_repr = json.dumps(state.model_dump(), sort_keys=True)
        h = hashlib.sha256(state_repr.encode()).hexdigest()
        hashes.add(h)

    assert len(hashes) == 1, f"State hash was not deterministic across 100 runs! Unique hashes: {len(hashes)}"
