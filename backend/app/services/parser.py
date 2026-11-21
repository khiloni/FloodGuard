import re
from typing import Optional, Dict, Any, List, Tuple
from ..engine.models import State, Action, ActionName
from ..engine.rules import validate_action_preconditions


def parse_action_text(text: str, state: State) -> Tuple[str, Optional[Action], Optional[Dict[str, Any]], Optional[str]]:
    """Parse player free-text input into a validated engine action or clarification/rejection.
    
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
    if "ward 1" in clean or "ward-1" in clean or "lowland" in clean or "hamlet" in clean:
        detected_zone = "ward-1"
    elif "ward 2" in clean or "ward-2" in clean or "market" in clean:
        detected_zone = "ward-2"
    elif "ward 3" in clean or "ward-3" in clean or "ridge" in clean or "highland" in clean:
        detected_zone = "ward-3"

    # Extract numbers (e.g. sandbags or boats)
    numbers = [int(n) for n in re.findall(r"\b\d+\b", clean)]

    # 1. Action: wait / observe
    if any(w in clean for w in ["wait", "do nothing", "observe", "pass turn", "hold"]):
        act = Action(name=ActionName.WAIT, params={})
        return "ok", act, None, None

    # 2. Action: open shelter
    if "shelter" in clean or "school" in clean:
        if any(w in clean for w in ["open", "unlock", "prep", "activate"]):
            act = Action(name=ActionName.OPEN_SHELTER, params={"shelter_id": "school"})
            valid, reason = validate_action_preconditions(state, act)
            if not valid:
                return "rejected", None, None, reason
            return "ok", act, None, None

    # 3. Action: reinforce embankment / sandbags
    if "embankment" in clean or "sandbag" in clean or "bund" in clean or "dike" in clean:
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
    if any(w in clean for w in ["vulnerable", "elderly", "children", "mobility", "special needs"]):
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
    if any(w in clean for w in ["talk", "consult", "ask", "speak", "call", "meet"]):
        if "sarpanch" in clean or "head" in clean or "mukhiya" in clean or "ramesh" in clean:
            npc_id = "village_head"
        elif "officer" in clean or "sunita" in clean or "worker" in clean or "ndrf" in clean:
            npc_id = "rescue_worker"
        elif "mohan" in clean or "family" in clean or "resident" in clean:
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
    if "boat" in clean or "vehicle" in clean or "truck" in clean:
        ttype = "boat" if "boat" in clean else "vehicle"
        count = 1
        for n in numbers:
            if 1 <= n <= 5:
                count = n
                break
        if "both" in clean:
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
    if "evacuate" in clean or "evacuation" in clean or "move out" in clean or "clear" in clean:
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
    if "warn" in clean or "alert" in clean or "broadcast" in clean:
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
