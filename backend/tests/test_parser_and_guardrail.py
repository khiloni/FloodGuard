import pytest
from backend.app.engine.loader import load_scenario
from backend.app.engine.models import ActionName
from backend.app.services.parser import parse_action_text
from backend.app.guardrail.emergency import detect_real_emergency
from backend.app.guardrail.validator import GuardrailValidator


def test_parser_natural_language():
    state = load_scenario("scenarios/village-river-01.yaml")

    # Positive mappings
    test_cases = [
        ("evacuate ward 1", ActionName.ORDER_EVACUATION, "ward-1"),
        ("evacuate ward-2 immediately", ActionName.ORDER_EVACUATION, "ward-2"),
        ("send 2 boats to ward 1", ActionName.ASSIGN_TRANSPORT, "ward-1"),
        ("dispatch vehicles to ward 2", ActionName.ASSIGN_TRANSPORT, "ward-2"),
        ("open the school shelter", ActionName.OPEN_SHELTER, None),
        ("reinforce embankment with 200 sandbags", ActionName.REINFORCE_EMBANKMENT, None),
        ("prioritize vulnerable people in ward 1", ActionName.PRIORITIZE_VULNERABLE, "ward-1"),
        ("warn ward 1", ActionName.ISSUE_WARNING, "ward-1"),
        ("broadcast flood warning", ActionName.ISSUE_WARNING, None),
        ("talk to sarpanch", ActionName.CONSULT_NPC, None),
        ("speak with officer sunita", ActionName.CONSULT_NPC, None),
        ("wait for next tick", ActionName.WAIT, None),
    ]

    for text, expected_action, expected_zone in test_cases:
        status, act, clarify, reject = parse_action_text(text, state)
        assert status == "ok", f"Failed for '{text}': status={status}, reason={reject or clarify}"
        assert act is not None
        assert act.name == expected_action
        if expected_zone:
            assert act.params.get("zone") == expected_zone

    # Ambiguous commands should trigger 'clarify', never guess!
    ambiguous_cases = [
        "evacuate",
        "send boats",
        "prioritize vulnerable",
        "talk to someone",
    ]
    for text in ambiguous_cases:
        status, act, clarify, reject = parse_action_text(text, state)
        assert status == "clarify", f"Ambiguous input '{text}' did not trigger clarify! Got {status}"
        assert clarify is not None
        assert "question" in clarify
        assert len(clarify.get("options", [])) > 0


def test_real_emergency_detection():
    # True positives: must trigger real emergency
    positives = [
        "I am actually trapped in my house right now",
        "real flood happening outside my door",
        "my home is actually flooding now please help",
        "help me I am in danger call 112 for me",
        "this is not a game someone is actually dying help",
    ]
    for text in positives:
        assert detect_real_emergency(text), f"Failed to detect emergency for: '{text}'"

    # True negatives: game roleplay commands must NOT trigger real emergency
    negatives = [
        "evacuate ward 1 and send boats",
        "water is rising in ward 2, order evacuation",
        "open the high school shelter for evacuees",
        "talk to Sarpanch Ramesh about the bund",
    ]
    for text in negatives:
        assert not detect_real_emergency(text), f"False emergency triggered for: '{text}'"


def test_guardrail_validator_redteam():
    validator = GuardrailValidator(allowed_names={"ward-1", "ward-2", "ward-3", "school"})
    facts_allowed = {1, 2, 10, 20, 100, 120, 180, 220, 360, 380, 112}

    # Red-team test 1: Fabricated unsupported numbers
    bad_numbers = "We evacuated 99999 people using 500 imaginary helicopters."
    passed, violations = validator.validate_text(bad_numbers, facts_allowed, events_this_turn=[])
    assert not passed
    assert any("Unsupported number" in v for v in violations)

    # Red-team test 2: Disallowed graphic vocabulary
    bad_tone = "The village was covered in blood and mutilated corpses."
    passed, violations = validator.validate_text(bad_tone, facts_allowed, events_this_turn=[])
    assert not passed
    assert any("Disallowed graphic vocabulary" in v for v in violations)

    # Red-team test 3: Unsubstantiated casualty claims without CASUALTY_OCCURRED event
    fake_casualties = "Sadly, many people died in the floodwaters."
    passed, violations = validator.validate_text(fake_casualties, facts_allowed, events_this_turn=[])
    assert not passed
    assert any("Casualty claim" in v for v in violations)

    # Red-team test 4: Legitimate clean narration should pass
    clean_text = "Tick 1: Water level rose to 180 cm. Access road to Ward 1 is monitored."
    passed, violations = validator.validate_text(clean_text, facts_allowed, events_this_turn=[])
    assert passed, f"Clean text failed validation: {violations}"
