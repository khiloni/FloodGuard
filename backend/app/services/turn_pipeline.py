from functools import lru_cache
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
from ..llm.openai_compat import (
    is_llm_enabled,
    narrate,
    npc_reply,
    parse_llm_action_fallback,
    get_llm_mode,
)
from ..rag.bm25 import BM25Retriever
from ..engine.loader import load_scenario_config
from .npc import allowed_facts_for_npc
from ..store.sqlite import SessionStore

# Initialize Rulecard Retriever
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
RULECARDS_FILE = os.path.join(BASE_DIR, "rulecards", "en", "rulecards.yaml")
retriever = BM25Retriever(RULECARDS_FILE)

@lru_cache(maxsize=32)
def _scenario_npcs(scenario_id: str) -> Dict[str, Dict[str, Any]]:
    path = os.path.join(BASE_DIR, "scenarios", f"{scenario_id}.yaml")
    try:
        cfg = load_scenario_config(path)
    except FileNotFoundError:
        return {}
    return {n["id"]: n for n in cfg.get("npcs", []) if "id" in n}


def npc_profile(scenario_id: str, npc_id: str) -> Dict[str, Any]:
    """Name, role and home location of an NPC from the scenario pack (persona for the LLM)."""
    n = _scenario_npcs(scenario_id).get(npc_id) or {}
    persona = f"{n['name']}, {n.get('role', 'a local responder')}" if n.get("name") else None
    return {"persona": persona, "location": n.get("location"), "name": n.get("name"), "role": n.get("role")}


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
    llm_mode = get_llm_mode()
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
            "guardrail": {"status": "passed", "retries": 0, "fallback_reason": None},
            "source": "template",
            "llm_mode": llm_mode,
            "disclaimer": SHORT_DISCLAIMER,
            "cited_rulecards": [],
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
            "guardrail": {"status": "passed", "retries": 0, "fallback_reason": None},
            "source": "template",
            "llm_mode": llm_mode,
            "disclaimer": SHORT_DISCLAIMER,
            "cited_rulecards": [],
        }

    input_type = turn_input.get("type", "button")

    # 1. Real Emergency Detector
    emergency_text = ""
    if input_type == "text":
        raw_text = turn_input.get("text")
        emergency_text = raw_text if isinstance(raw_text, str) else ""
    elif input_type == "button":
        act_data_raw = turn_input.get("action")
        if isinstance(act_data_raw, dict) and act_data_raw.get("name") == "consult_npc":
            params_raw = act_data_raw.get("params")
            if isinstance(params_raw, dict):
                raw_msg = params_raw.get("user_message")
                emergency_text = raw_msg if isinstance(raw_msg, str) else ""

    if detect_real_emergency(emergency_text):
        return {
            "status": "real_emergency",
            "parsed_action": None,
            "clarify": None,
            "reject_reason": "REAL EMERGENCY DETECTED",
            "state": state.model_dump(),
            "events": [],
            "narration": {"text": EMERGENCY_RESPONSE_MESSAGE, "source": "emergency_override"},
            "npc_messages": [],
            "guardrail": {"status": "passed", "retries": 0, "fallback_reason": "emergency_override"},
            "source": "emergency_override",
            "llm_mode": llm_mode,
            "disclaimer": EMERGENCY_RESPONSE_MESSAGE,
            "cited_rulecards": [],
        }

    # 2. Action Parsing / Resolution
    parsed_action: Optional[Action] = None
    if input_type == "button":
        act_data = turn_input.get("action")
        if not isinstance(act_data, dict):
            return {
                "status": "rejected",
                "parsed_action": None,
                "clarify": None,
                "reject_reason": "Invalid or missing button action payload.",
                "state": state.model_dump(),
                "events": [],
                "narration": {"text": "Unrecognized button action.", "source": "template"},
                "npc_messages": [],
                "guardrail": {"status": "passed", "retries": 0, "fallback_reason": None},
                "source": "template",
                "llm_mode": llm_mode,
                "disclaimer": SHORT_DISCLAIMER,
                "cited_rulecards": [],
            }
        try:
            name_val = ActionName(act_data.get("name"))
            params_val = act_data.get("params")
            if params_val is None:
                params_val = {}
            if not isinstance(params_val, dict):
                raise ValueError("Action params must be an object.")
            parsed_action = Action(name=name_val, params=params_val)
            status = "ok"
            clarify = None
            reject_reason = None
        except (ValueError, TypeError) as err:
            return {
                "status": "rejected",
                "parsed_action": None,
                "clarify": None,
                "reject_reason": f"Invalid action name: {err}",
                "state": state.model_dump(),
                "events": [],
                "narration": {"text": "Unrecognized button action.", "source": "template"},
                "npc_messages": [],
                "guardrail": {"status": "passed", "retries": 0, "fallback_reason": None},
                "source": "template",
                "llm_mode": llm_mode,
                "disclaimer": SHORT_DISCLAIMER,
                "cited_rulecards": [],
            }
    elif input_type == "text":
        raw_text = turn_input.get("text")
        if not isinstance(raw_text, str):
            return {
                "status": "rejected",
                "parsed_action": None,
                "clarify": None,
                "reject_reason": "Invalid or missing text input.",
                "state": state.model_dump(),
                "events": [],
                "narration": {"text": "Invalid text input.", "source": "template"},
                "npc_messages": [],
                "guardrail": {"status": "passed", "retries": 0, "fallback_reason": None},
                "source": "template",
                "llm_mode": llm_mode,
                "disclaimer": SHORT_DISCLAIMER,
                "cited_rulecards": [],
            }
        user_text = raw_text
        status, parsed_action, clarify, reject_reason = parse_action_text(user_text, state)
        # If ambiguous/unrecognized and LLM is enabled, attempt LLM fallback parsing
        if status == "clarify" and is_llm_enabled():
            llm_status, llm_act, llm_clarify, llm_reject = parse_llm_action_fallback(user_text, state)
            if llm_status == "ok" and llm_act:
                status, parsed_action, clarify, reject_reason = "ok", llm_act, None, None
            elif llm_status == "rejected":
                status, parsed_action, clarify, reject_reason = "rejected", None, None, llm_reject
            elif llm_clarify:
                is_existing_generic = (
                    not clarify
                    or str(clarify.get("question", "")).startswith("Could not determine action from ")
                )
                is_llm_generic = str(llm_clarify.get("question", "")).startswith("Could not determine an action from ")
                if is_existing_generic or not is_llm_generic:
                    clarify = llm_clarify
    else:
        return {
            "status": "rejected",
            "parsed_action": None,
            "clarify": None,
            "reject_reason": f"Invalid input type: {input_type!r}.",
            "state": state.model_dump(),
            "events": [],
            "narration": {"text": "Invalid input type.", "source": "template"},
            "npc_messages": [],
            "guardrail": {"status": "passed", "retries": 0, "fallback_reason": None},
            "source": "template",
            "llm_mode": llm_mode,
            "disclaimer": SHORT_DISCLAIMER,
            "cited_rulecards": [],
        }

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
            "guardrail": {"status": "passed", "retries": 0, "fallback_reason": None},
            "source": "template",
            "llm_mode": llm_mode,
            "disclaimer": SHORT_DISCLAIMER,
            "cited_rulecards": [],
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
            "guardrail": {"status": "passed", "retries": 0, "fallback_reason": None},
            "source": "template",
            "llm_mode": llm_mode,
            "disclaimer": SHORT_DISCLAIMER,
            "cited_rulecards": [],
        }

    # 4. Advance Engine Step Deterministically
    # Replay/seed principle: use session seed combined with tick for RNG
    seed = session["seed"] + state.tick
    rng = random.Random(seed)
    new_state, events = step(state, parsed_action, rng)

    # 5. Retrieve Educational Rule Card (RAG)
    query_str = f"{parsed_action.name.value.replace('_', ' ')} {' '.join(str(v) for v in parsed_action.params.values())}"
    relevant_cards = retriever.query(query_str, top_k=1)

    # 6. Generate Narration and NPC Dialogue (LLM or Template Fallback)
    facts_allowed = get_facts_allowed_from_state_and_events(new_state, events)
    nar_res = narrate(
        state=new_state,
        events=events,
        rule_cards=relevant_cards,
        validator=validator,
        facts_allowed=facts_allowed,
        language=session.get("language", "en"),
    )

    # NPC responses for consultation
    npc_messages: List[Dict[str, Any]] = []
    npc_res = None
    if parsed_action.name == ActionName.CONSULT_NPC:
        npc_id = parsed_action.params.get("npc_id", "village_head")
        user_msg = parsed_action.params.get("user_message", "")
        profile = npc_profile(session["scenario_id"], npc_id)
        npc_res = npc_reply(
            npc_id=npc_id,
            state=new_state,
            events=events,
            user_message=user_msg,
            validator=validator,
            facts_allowed=allowed_facts_for_npc(npc_id, new_state, events, facts_allowed, profile.get("location")),
            language=session.get("language", "en"),
            rule_cards=relevant_cards,
            persona=profile.get("persona"),
            location=profile.get("location"),
        )
        npc_messages.append({
            "npc_id": npc_id,
            "text": npc_res.text,
            "source": npc_res.source,
        })

    total_retries = nar_res.retries + (npc_res.retries if npc_res else 0)
    if nar_res.status == "fallback" or (npc_res is not None and npc_res.status == "fallback"):
        guardrail_status = "fallback"
        fallback_reason = nar_res.reason or (npc_res.reason if npc_res else None)
    else:
        guardrail_status = "passed"
        fallback_reason = None

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
            zone=ev.zone,
            target=ev.target,
        )

    top_source = nar_res.source
    if npc_res is not None and npc_res.source == "template":
        top_source = "template"

    return {
        "status": "ok",
        "parsed_action": parsed_action.model_dump(),
        "clarify": None,
        "reject_reason": None,
        "state": new_state.model_dump(),
        "events": [e.model_dump() for e in events],
        "narration": {"text": nar_res.text, "source": nar_res.source},
        "npc_messages": npc_messages,
        "guardrail": {
            "status": guardrail_status,
            "retries": total_retries,
            "fallback_reason": fallback_reason,
        },
        "source": top_source,
        "llm_mode": llm_mode,
        "disclaimer": SHORT_DISCLAIMER,
        "cited_rulecards": relevant_cards,
    }
