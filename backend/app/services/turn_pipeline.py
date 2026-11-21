import os
import random
from typing import Dict, Any, Tuple, Optional, List
from ..engine.models import State, Action, ActionName, Event
from ..engine.step import step
from ..engine.rules import validate_action_preconditions
from ..guardrail.emergency import detect_real_emergency, EMERGENCY_RESPONSE_MESSAGE
from ..guardrail.validator import GuardrailValidator
from ..services.parser import parse_action_text
from ..services.narration import generate_template_narration, get_facts_allowed_from_state_and_events
from ..services.npc import generate_npc_message
from ..rag.bm25 import BM25Retriever
from ..store.sqlite import SessionStore

# Initialize Rulecard Retriever
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
RULECARDS_FILE = os.path.join(BASE_DIR, "rulecards", "en", "rulecards.yaml")
retriever = BM25Retriever(RULECARDS_FILE)

SHORT_DISCLAIMER = "FloodGuard is an educational simulation. For real-life flood emergencies in India, call 112."


def process_turn(
    session_id: str,
    turn_input: Dict[str, Any],
    store: SessionStore,
    validator: GuardrailValidator,
) -> Dict[str, Any]:
    """Execute the full turn pipeline:
    Validate -> Parse -> Check Preconditions -> Step Engine -> Narrate -> Guardrail -> Store
    """
    session = store.get_session(session_id)
    if not session:
        return {
            "status": "rejected",
            "parsed_action": None,
            "clarify": None,
            "reject_reason": f"Session '{session_id}' not found.",
            "state": None,
            "events": [],
            "narration": {"text": "Session not found.", "source": "template"},
            "npc_messages": [],
            "guardrail": {"status": "passed", "retries": 0},
            "disclaimer": SHORT_DISCLAIMER,
        }

    state = State.model_validate(session["state"])
    if state.is_finished:
        return {
            "status": "rejected",
            "parsed_action": None,
            "clarify": None,
            "reject_reason": "This simulation session has already completed. Check the After-Action Report.",
            "state": state.model_dump(),
            "events": [],
            "narration": {"text": "Simulation finished.", "source": "template"},
            "npc_messages": [],
            "guardrail": {"status": "passed", "retries": 0},
            "disclaimer": SHORT_DISCLAIMER,
        }

    input_type = turn_input.get("type", "button")

    # 1. Real Emergency Detector
    if input_type == "text":
        user_text = turn_input.get("text", "")
        if detect_real_emergency(user_text):
            return {
                "status": "real_emergency",
                "parsed_action": None,
                "clarify": None,
                "reject_reason": "REAL EMERGENCY DETECTED",
                "state": state.model_dump(),
                "events": [],
                "narration": {"text": EMERGENCY_RESPONSE_MESSAGE, "source": "emergency_override"},
                "npc_messages": [],
                "guardrail": {"status": "passed", "retries": 0},
                "disclaimer": EMERGENCY_RESPONSE_MESSAGE,
            }

    # 2. Action Parsing / Resolution
    parsed_action: Optional[Action] = None
    if input_type == "button":
        act_data = turn_input.get("action", {})
        try:
            name_val = ActionName(act_data.get("name"))
            parsed_action = Action(name=name_val, params=act_data.get("params", {}))
            status = "ok"
            clarify = None
            reject_reason = None
        except ValueError as err:
            return {
                "status": "rejected",
                "parsed_action": None,
                "clarify": None,
                "reject_reason": f"Invalid action name: {err}",
                "state": state.model_dump(),
                "events": [],
                "narration": {"text": "Unrecognized button action.", "source": "template"},
                "npc_messages": [],
                "guardrail": {"status": "passed", "retries": 0},
                "disclaimer": SHORT_DISCLAIMER,
            }
    else:
        user_text = turn_input.get("text", "")
        status, parsed_action, clarify, reject_reason = parse_action_text(user_text, state)

    # If clarify or rejected: state and time DO NOT advance!
    if status in ("clarify", "rejected"):
        return {
            "status": status,
            "parsed_action": parsed_action.model_dump() if parsed_action else None,
            "clarify": clarify,
            "reject_reason": reject_reason,
            "state": state.model_dump(),
            "events": [],
            "narration": {
                "text": reject_reason or (clarify.get("question") if clarify else "Clarification requested."),
                "source": "template",
            },
            "npc_messages": [],
            "guardrail": {"status": "passed", "retries": 0},
            "disclaimer": SHORT_DISCLAIMER,
        }

    # 3. Validate Preconditions
    is_valid, reject_msg = validate_action_preconditions(state, parsed_action)
    if not is_valid:
        return {
            "status": "rejected",
            "parsed_action": parsed_action.model_dump(),
            "clarify": None,
            "reject_reason": reject_msg,
            "state": state.model_dump(),
            "events": [],
            "narration": {"text": reject_msg, "source": "template"},
            "npc_messages": [],
            "guardrail": {"status": "passed", "retries": 0},
            "disclaimer": SHORT_DISCLAIMER,
        }

    # 4. Advance Engine Step Deterministically
    # Replay/seed principle: use session seed combined with tick for RNG
    seed = session["seed"] + state.tick
    rng = random.Random(seed)
    new_state, events = step(state, parsed_action, rng)

    # 5. Retrieve Educational Rule Card (RAG)
    query_str = f"{parsed_action.name.value} {' '.join(str(v) for v in parsed_action.params.values())}"
    relevant_cards = retriever.query(query_str, top_k=1)
    cited_cards = [c["id"] for c in relevant_cards] if relevant_cards else []

    # 6. Generate Narration and NPC Dialogue
    narration_text = generate_template_narration(new_state, events)
    facts_allowed = get_facts_allowed_from_state_and_events(new_state, events)

    # 7. Output Guardrail Validation
    passed, violations = validator.validate_text(
        narration_text, facts_allowed, events, cited_cards
    )
    guardrail_status = "passed" if passed else "fallback"
    if not passed:
        # Fallback to pure factual log statement
        narration_text = f"Tick {new_state.tick}: Water level reached {new_state.water_level_cm} cm. Actions processed."

    # NPC responses for consultation or passive observation
    npc_messages: List[Dict[str, Any]] = []
    if parsed_action.name == ActionName.CONSULT_NPC:
        npc_id = parsed_action.params.get("npc_id", "village_head")
        npc_msg = generate_npc_message(npc_id, new_state)
        npc_messages.append(npc_msg)

    # 8. Store Session Update
    actions_list = session["actions"]
    actions_list.append(parsed_action.model_dump())
    store.update_session(
        session_id=session_id,
        actions=actions_list,
        state_dict=new_state.model_dump(),
        is_ended=new_state.is_finished,
    )
    for ev in events:
        store.log_event(
            session_id=session_id,
            tick=ev.tick,
            event_type=ev.type.value,
            description=ev.description,
            caused_by=ev.caused_by,
            details=ev.details,
        )

    return {
        "status": "ok",
        "parsed_action": parsed_action.model_dump(),
        "clarify": None,
        "reject_reason": None,
        "state": new_state.model_dump(),
        "events": [e.model_dump() for e in events],
        "narration": {"text": narration_text, "source": "template"},
        "npc_messages": npc_messages,
        "guardrail": {"status": guardrail_status, "retries": 0},
        "disclaimer": SHORT_DISCLAIMER,
        "cited_rulecards": relevant_cards,
    }
