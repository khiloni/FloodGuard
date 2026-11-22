import re
from typing import Optional, Dict, Any, List, Tuple
from ..engine.models import State, Action, ActionName
from ..engine.rules import validate_action_preconditions


def parse_action_text(text: str, state: State) -> Tuple[str, Optional[Action], Optional[Dict[str, Any]], Optional[str]]:
    """Parse player free-text input into a validated engine action or clarification/rejection.
    Supports typos, English-Hindi code-mixed phrasing, and detects conflicting ties.
    
    Returns:
        (status, parsed_action, clarify_dict, reject_reason)
        status in ("ok", "clarify", "rejected")
    """
    clean = text.strip().lower()
    if not clean:
        return "clarify", None, {
            "question": "Please select or type an action to take this turn.",
            "options": [
                {"name": "issue_warning", "params": {}},
                {"name": "open_shelter", "params": {"shelter_id": "school"}},
                {"name": "wait", "params": {}},
            ],
        }, None

    # Detect Zone
    detected_zone = None
    if any(k in clean for k in ["ward 1", "ward-1", "ward1", "lowland", "hamlet", "first ward", "ward ek", "ward number 1"]):
        detected_zone = "ward-1"
    elif any(k in clean for k in ["ward 2", "ward-2", "ward2", "market", "second ward", "ward do", "ward number 2"]):
        detected_zone = "ward-2"
    elif any(k in clean for k in ["ward 3", "ward-3", "ward3", "ridge", "highland", "third ward", "ward teen", "ward number 3"]):
        detected_zone = "ward-3"

    # Extract numbers (e.g. sandbags or boats)
    numbers = [int(n) for n in re.findall(r"\b\d+\b", clean)]

    # Detect candidate actions
    has_wait = any(w in clean for w in [
        "wait", "do nothing", "observe", "pass turn", "hold", "intezar", "roko", "thahro", "ruk jao", "stand by"
    ])
    has_shelter = any(w in clean for w in [
        "shelter", "sheltar", "shlter", "school", "shool"
    ]) and any(w in clean for w in ["open", "unlock", "prep", "activate", "kholo", "start", "tayyar"])

    has_embankment = any(w in clean for w in [
        "embankment", "embakment", "embankmnt", "sandbag", "sandbags", "bund", "dike", "baandh", "bori", "boriyan"
    ])
    has_vulnerable = any(w in clean for w in [
        "vulnerable", "vulnrable", "vulnerabl", "elderly", "children", "mobility", "special needs",
        "buzurg", "buddhe", "bachhe", "bache", "elders"
    ])
    has_npc = any(w in clean for w in [
        "talk", "consult", "ask", "speak", "call", "meet", "baat", "pucho", "batao", "milna", "charcha"
    ]) or any(w in clean for w in ["sarpanch", "sunita", "mohan"])

    has_transport = any(w in clean for w in [
        "boat", "boats", "bot", "bots", "vehicle", "vehicles", "truck", "trucks", "naav", "gaadi"
    ])
    has_evacuate = any(w in clean for w in [
        "evacuate", "evacuation", "evauate", "evac", "evacuaet", "move out", "clear", "nikalo", "hatao", "khalo"
    ])
    has_warn = any(w in clean for w in [
        "warn", "warning", "wrn", "waarn", "alert", "broadcast", "chetavani", "suchna", "alarm", "aagah"
    ])

    # Check for TIES (multiple distinct conflicting operations)
    detected_candidates = []
    if has_wait: detected_candidates.append("wait")
    if has_shelter: detected_candidates.append("open_shelter")
    if has_embankment: detected_candidates.append("reinforce_embankment")
    if has_vulnerable: detected_candidates.append("prioritize_vulnerable")
    if has_npc: detected_candidates.append("consult_npc")
    if has_transport: detected_candidates.append("assign_transport")
    if has_evacuate: detected_candidates.append("order_evacuation")
    if has_warn: detected_candidates.append("issue_warning")

    # If there are 2+ distinct candidate actions in one phrase (e.g. "evacuate and warn"), declare a tie!
    if len(detected_candidates) > 1:
        # Check if one is a modifier of another (e.g. transport with vulnerable or evacuation with boats)
        if set(detected_candidates) == {"order_evacuation", "assign_transport"}:
            pass  # prioritize transport if transport words are prominent
        elif set(detected_candidates) == {"prioritize_vulnerable", "assign_transport"}:
            pass
        elif set(detected_candidates) == {"order_evacuation", "prioritize_vulnerable"}:
            pass
        else:
            return "clarify", None, {
                "question": f"Multiple actions detected ({', '.join(detected_candidates)}). Only one action is permitted per tick. Please choose which one to execute:",
                "options": [
                    {"name": c, "params": ({"zone": detected_zone} if detected_zone and c in ["order_evacuation", "issue_warning", "prioritize_vulnerable"] else {})}
                    for c in detected_candidates[:4]
                ],
            }, None

    # 1. Action: wait / observe
    if has_wait:
        act = Action(name=ActionName.WAIT, params={})
        return "ok", act, None, None

    # 2. Action: open shelter
    if has_shelter:
        act = Action(name=ActionName.OPEN_SHELTER, params={"shelter_id": "school"})
        valid, reason = validate_action_preconditions(state, act)
        if not valid:
            return "rejected", None, None, reason
        return "ok", act, None, None

    # 3. Action: reinforce embankment / sandbags
    if has_embankment:
        bags = 100
        for n in numbers:
            if n in [50, 100, 200, 300, 400]:
                bags = n
                break
        act = Action(name=ActionName.REINFORCE_EMBANKMENT, params={"sandbags": bags})
        valid, reason = validate_action_preconditions(state, act)
        if not valid:
            return "rejected", None, None, reason
        return "ok", act, None, None

    # 4. Action: prioritize vulnerable
    if has_vulnerable:
        if not detected_zone:
            return "clarify", None, {
                "question": "Which zone's vulnerable residents would you like to prioritize?",
                "options": [
                    {"name": "prioritize_vulnerable", "params": {"zone": "ward-1"}},
                    {"name": "prioritize_vulnerable", "params": {"zone": "ward-2"}},
                    {"name": "prioritize_vulnerable", "params": {"zone": "ward-3"}},
                ],
            }, None
        act = Action(name=ActionName.PRIORITIZE_VULNERABLE, params={"zone": detected_zone})
        valid, reason = validate_action_preconditions(state, act)
        if not valid:
            return "rejected", None, None, reason
        return "ok", act, None, None

    # 5. Action: consult NPC / talk / discuss
    if has_npc:
        if any(w in clean for w in ["sarpanch", "head", "mukhiya", "ramesh", "pradhan"]):
            npc_id = "village_head"
        elif any(w in clean for w in ["officer", "sunita", "worker", "ndrf", "volunteer"]):
            npc_id = "rescue_worker"
        elif any(w in clean for w in ["mohan", "family", "resident", "parivar"]):
            npc_id = "family_member"
        else:
            return "clarify", None, {
                "question": "Who would you like to consult?",
                "options": [
                    {"name": "consult_npc", "params": {"npc_id": "village_head"}},
                    {"name": "consult_npc", "params": {"npc_id": "rescue_worker"}},
                    {"name": "consult_npc", "params": {"npc_id": "family_member"}},
                ],
            }, None
        act = Action(name=ActionName.CONSULT_NPC, params={"npc_id": npc_id})
        return "ok", act, None, None

    # 6. Action: assign transport (boat / vehicle)
    if has_transport:
        ttype = "boat" if any(w in clean for w in ["boat", "boats", "bot", "bots", "naav"]) else "vehicle"
        count = 1
        for n in numbers:
            if 1 <= n <= 5:
                count = n
                break
        if "both" in clean or "dono" in clean:
            count = 2

        if not detected_zone:
            return "clarify", None, {
                "question": f"Which zone should the {ttype}(s) be dispatched to?",
                "options": [
                    {"name": "assign_transport", "params": {"zone": "ward-1", "transport_type": ttype, "count": count}},
                    {"name": "assign_transport", "params": {"zone": "ward-2", "transport_type": ttype, "count": count}},
                ],
            }, None

        act = Action(name=ActionName.ASSIGN_TRANSPORT, params={"zone": detected_zone, "transport_type": ttype, "count": count})
        valid, reason = validate_action_preconditions(state, act)
        if not valid:
            return "rejected", None, None, reason
        return "ok", act, None, None

    # 7. Action: order evacuation
    if has_evacuate:
        if not detected_zone:
            return "clarify", None, {
                "question": "Which ward should receive the mandatory evacuation order?",
                "options": [
                    {"name": "order_evacuation", "params": {"zone": "ward-1"}},
                    {"name": "order_evacuation", "params": {"zone": "ward-2"}},
                    {"name": "order_evacuation", "params": {"zone": "ward-3"}},
                ],
            }, None
        act = Action(name=ActionName.ORDER_EVACUATION, params={"zone": detected_zone})
        valid, reason = validate_action_preconditions(state, act)
        if not valid:
            return "rejected", None, None, reason
        return "ok", act, None, None

    # 8. Action: issue warning
    if has_warn:
        act = Action(name=ActionName.ISSUE_WARNING, params={"zone": detected_zone} if detected_zone else {})
        valid, reason = validate_action_preconditions(state, act)
        if not valid:
            return "rejected", None, None, reason
        return "ok", act, None, None

    # Unrecognized command -> clarify options
    return "clarify", None, {
        "question": f"Could not determine action from '{text}'. Please choose one of the available operations:",
        "options": [
            {"name": "issue_warning", "params": {}},
            {"name": "order_evacuation", "params": {"zone": "ward-1"}},
            {"name": "open_shelter", "params": {"shelter_id": "school"}},
            {"name": "reinforce_embankment", "params": {"sandbags": 100}},
            {"name": "wait", "params": {}},
        ],
    }, None
