import random
import pytest
from backend.app.engine.loader import load_scenario
from backend.app.engine.step import step
from backend.app.engine.models import Action, ActionName
from backend.app.engine.scoring import calculate_score


def test_golden_scenario_do_nothing():
    """Do-nothing playbook: player takes no protective actions. Score must be below 30."""
    scenario_path = "scenarios/village-river-01.yaml"
    state = load_scenario(scenario_path)
    rng = random.Random(123)

    while not state.is_finished:
        state, _ = step(state, Action(name=ActionName.WAIT, params={}), rng)

    score = state.score or calculate_score(state)
    assert score.total_score < 30, f"Do-nothing score was {score.total_score}, expected < 30"


def test_golden_scenario_expert_playbook():
    """Scripted expert playbook: early warning, open shelter, reinforce embankment, deploy boats & vehicles, prioritize vulnerable.
    Score must be above 80."""
    scenario_path = "scenarios/village-river-01.yaml"
    state = load_scenario(scenario_path)
    rng = random.Random(123)

    playbook = [
        Action(name=ActionName.OPEN_SHELTER, params={"shelter_id": "school"}),
        Action(name=ActionName.ISSUE_WARNING, params={}),
        Action(name=ActionName.ORDER_EVACUATION, params={"zone": "ward-1"}),
        Action(name=ActionName.PRIORITIZE_VULNERABLE, params={"zone": "ward-1"}),
        Action(name=ActionName.ASSIGN_TRANSPORT, params={"zone": "ward-1", "transport_type": "boat", "count": 2}),
        Action(name=ActionName.ASSIGN_TRANSPORT, params={"zone": "ward-2", "transport_type": "vehicle", "count": 2}),
        Action(name=ActionName.REINFORCE_EMBANKMENT, params={"sandbags": 200}),
        Action(name=ActionName.REINFORCE_EMBANKMENT, params={"sandbags": 200}),
        Action(name=ActionName.ORDER_EVACUATION, params={"zone": "ward-2"}),
        Action(name=ActionName.PRIORITIZE_VULNERABLE, params={"zone": "ward-2"}),
        Action(name=ActionName.ORDER_EVACUATION, params={"zone": "ward-3"}),
    ]

    for act in playbook:
        if not state.is_finished:
            state, _ = step(state, act, rng)

    while not state.is_finished:
        state, _ = step(state, Action(name=ActionName.WAIT, params={}), rng)

    score = state.score or calculate_score(state)
    assert score.total_score >= 80, f"Expert playbook score was {score.total_score}, expected >= 80"


def test_metamorphic_prioritize_vulnerable():
    """Metamorphic property: Prioritizing vulnerable in an evacuating zone must never result in fewer vulnerable saved."""
    scenario_path = "scenarios/village-river-01.yaml"
    
    # Run A: Without explicit prioritization
    state_a = load_scenario(scenario_path)
    rng_a = random.Random(999)
    actions_a = [
        Action(name=ActionName.OPEN_SHELTER, params={"shelter_id": "school"}),
        Action(name=ActionName.ORDER_EVACUATION, params={"zone": "ward-1"}),
        Action(name=ActionName.ASSIGN_TRANSPORT, params={"zone": "ward-1", "transport_type": "boat", "count": 1}),
        Action(name=ActionName.WAIT, params={}),
    ]
    for act in actions_a:
        state_a, _ = step(state_a, act, rng_a)

    # Run B: With explicit prioritization
    state_b = load_scenario(scenario_path)
    rng_b = random.Random(999)
    actions_b = [
        Action(name=ActionName.OPEN_SHELTER, params={"shelter_id": "school"}),
        Action(name=ActionName.ORDER_EVACUATION, params={"zone": "ward-1"}),
        Action(name=ActionName.PRIORITIZE_VULNERABLE, params={"zone": "ward-1"}),
        Action(name=ActionName.ASSIGN_TRANSPORT, params={"zone": "ward-1", "transport_type": "boat", "count": 1}),
    ]
    for act in actions_b:
        state_b, _ = step(state_b, act, rng_b)

    vuln_saved_a = state_a.zones["ward-1"].vulnerable_saved
    vuln_saved_b = state_b.zones["ward-1"].vulnerable_saved
    assert vuln_saved_b >= vuln_saved_a, f"Prioritization reduced vulnerable saved! B={vuln_saved_b} < A={vuln_saved_a}"
