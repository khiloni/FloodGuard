import random

from backend.app.engine.loader import load_scenario
from backend.app.engine.step import step
from backend.app.engine.models import Action, ActionName
from backend.app.engine.rules import validate_action_preconditions
from backend.app.engine.scoring import calculate_score

SCENARIO = "scenarios/village-river-01.yaml"
WAIT = Action(name=ActionName.WAIT, params={})


def A(name, **params):
    return Action(name=ActionName(name), params=params)


FLOOD_EXPERT = {
    1: A("open_shelter", shelter_id="school"),
    2: A("issue_warning"),
    3: A("order_evacuation", zone="ward-1"),
    4: A("prioritize_vulnerable", zone="ward-1"),
    5: A("assign_transport", zone="ward-1", transport_type="boat", count=2),
    6: A("assign_transport", zone="ward-2", transport_type="vehicle", count=2),
    7: A("reinforce_embankment", sandbags=200),
    8: A("reinforce_embankment", sandbags=200),
    9: A("order_evacuation", zone="ward-2"),
    10: A("prioritize_vulnerable", zone="ward-2"),
    11: A("order_evacuation", zone="ward-3"),
}

RECOVERY_EXPERT = {
    12: A("distribute_supplies"),
    15: A("distribute_supplies"),
    18: A("provide_clean_water"),
    19: A("run_medical_camp"),
    20: A("damage_survey", zone="ward-2"),
    21: A("clear_roads", zone="ward-2"),
    22: A("restore_power"),
    23: A("return_residents", zone="ward-2"),
    24: A("clear_roads", zone="ward-1"),
    25: A("damage_survey", zone="ward-1"),
    26: A("return_residents", zone="ward-1"),
    27: A("return_residents", zone="ward-1"),
    28: A("return_residents", zone="ward-3"),
    29: A("return_residents", zone="ward-2"),
}


def play(plan, strict=True, seed=123):
    """Run a {tick: action} plan to the end; other ticks wait. Returns (final_state, per_tick_states)."""
    state = load_scenario(SCENARIO)
    rng = random.Random(seed)
    history = []
    while not state.is_finished:
        act = plan.get(state.tick + 1, WAIT)
        ok, why = validate_action_preconditions(state, act)
        if not ok:
            assert not strict, f"tick {state.tick + 1}: {act.name.value} rejected: {why}"
            act = WAIT
        state, _ = step(state, act, rng)
        history.append(state)
    return state, history


def test_golden_do_nothing():
    state, _ = play({})
    score = state.score or calculate_score(state)
    assert state.tick == state.max_ticks == 30
    assert score.total_score < 30, score.total_score


def test_golden_three_phase_expert_playbook():
    state, _ = play({**FLOOD_EXPERT, **RECOVERY_EXPERT})
    s = state.score
    assert s.total_score >= 80, s.total_score
    assert s.public_health_score + s.essential_services_score + s.safe_return_score + s.community_trust_score >= 18
    assert state.recovery.clean_water_active and state.recovery.power_on
    assert all(not z.road_blocked for z in state.zones.values())


def test_golden_flood_only_expert_cannot_exceed_flood_weights():
    """A perfect flood response that ignores recovery is capped by the 75 flood points plus
    whatever trust is left: recovery matters."""
    flood_only, _ = play(FLOOD_EXPERT)
    full, _ = play({**FLOOD_EXPERT, **RECOVERY_EXPERT})
    assert flood_only.score.total_score <= 80
    assert full.score.total_score > flood_only.score.total_score
    assert flood_only.score.safe_return_score == 0


def test_metamorphic_prioritize_vulnerable():
    """Prioritising vulnerable residents never saves fewer of them."""
    def run(actions):
        state = load_scenario(SCENARIO)
        rng = random.Random(999)
        for act in actions:
            state, _ = step(state, act, rng)
        return state.zones["ward-1"].vulnerable_saved

    a = run([A("open_shelter", shelter_id="school"), A("order_evacuation", zone="ward-1"),
             A("assign_transport", zone="ward-1", transport_type="boat", count=1), WAIT])
    b = run([A("open_shelter", shelter_id="school"), A("order_evacuation", zone="ward-1"),
             A("prioritize_vulnerable", zone="ward-1"),
             A("assign_transport", zone="ward-1", transport_type="boat", count=1)])
    assert b >= a


def _swap_earlier(plan, action, early, late):
    """Plan B = plan with `action` at `early` (and nothing at `late`); plan A has it at `late`."""
    a = {**plan, late: action}
    a.pop(early, None)
    b = {**plan, early: action}
    b.pop(late, None)
    return a, b


def test_metamorphic_clean_water_earlier_never_raises_disease_risk():
    base = dict(FLOOD_EXPERT)
    for early, late in [(18, 20), (18, 25), (21, 28)]:
        plan_a, plan_b = _swap_earlier(base, A("provide_clean_water"), early, late)
        _, hist_a = play(plan_a)
        _, hist_b = play(plan_b)
        for sa, sb in zip(hist_a, hist_b):
            assert sb.recovery.disease_risk <= sa.recovery.disease_risk, (early, late, sa.tick)
        assert hist_b[-1].recovery.peak_disease_risk <= hist_a[-1].recovery.peak_disease_risk


def test_metamorphic_medical_camp_earlier_never_raises_untreated_illness():
    for early, late in [(18, 22), (20, 27)]:
        plan_a, plan_b = _swap_earlier({}, A("run_medical_camp"), early, late)
        _, hist_a = play(plan_a)
        _, hist_b = play(plan_b)
        for sa, sb in zip(hist_a, hist_b):
            ua = sa.recovery.illness_cases - sa.recovery.illness_treated
            ub = sb.recovery.illness_cases - sb.recovery.illness_treated
            assert ub <= ua, (early, late, sa.tick)
            assert sb.recovery.disease_risk <= sa.recovery.disease_risk


def test_metamorphic_supplies_never_lower_trust():
    without, h_without = play(FLOOD_EXPERT)
    with_supplies, h_with = play({**FLOOD_EXPERT, 12: A("distribute_supplies"), 20: A("distribute_supplies")})
    for sa, sb in zip(h_without, h_with):
        assert sb.recovery.community_trust >= sa.recovery.community_trust, sa.tick
        assert sb.recovery.disease_risk <= sa.recovery.disease_risk, sa.tick
