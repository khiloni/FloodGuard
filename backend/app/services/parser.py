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
    in_recovery = state.phase == "recovery"
    if not clean:
        return "clarify", None, {
            "question": "Please select or type an action to take this turn.",
            "options": _default_options(state)[:3],
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
    # Recovery-phase actions (Part 2)
    has_clear_roads = (
        any(w in clean for w in ["debris", "malba", "road clearing", "clear road", "clear the road", "clear roads",
                                 "clear the roads", "sadak saaf", "unblock road", "unblock the road"])
    )
    has_search = any(w in clean for w in ["search and rescue", "search", "stranded", "khoj", "dhundo", "trapped residents"])
    has_supplies = any(w in clean for w in ["supplies", "supply", "relief kit", "ration", "rashan", "food", "khana"])
    has_clean_water = any(w in clean for w in [
        "clean water", "drinking water", "safe water", "purif", "chlorin", "saaf paani", "peene ka paani", "water point"
    ])
    has_medical = any(w in clean for w in ["medical", "doctor", "health camp", "clinic", "medicine", "dawai", "dawa"])
    has_power = any(w in clean for w in ["power", "electricity", "bijli", "substation"])
    has_survey = any(w in clean for w in ["survey", "assess damage", "damage assessment", "inspect", "jaanch", "check damage"])
    has_return = any(w in clean for w in [
        "return", "go home", "send home", "back home", "send them home", "ghar wapas", "wapas bhejo", "move back"
    ])

    has_evacuate = any(w in clean for w in [
        "evacuate", "evacuation", "evauate", "evac", "evacuaet", "move out", "nikalo", "hatao", "khalo"
    ] + ([] if has_clear_roads else ["clear"]))
    if has_search:
        has_transport = False  # boats are part of a search-and-rescue order
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
    if has_search: detected_candidates.append("search_and_rescue")
    if has_supplies: detected_candidates.append("distribute_supplies")
    if has_clean_water: detected_candidates.append("provide_clean_water")
    if has_medical: detected_candidates.append("run_medical_camp")
    if has_power: detected_candidates.append("restore_power")
    if has_clear_roads: detected_candidates.append("clear_roads")
    if has_survey: detected_candidates.append("damage_survey")
    if has_return: detected_candidates.append("return_residents")

    # If there are 2+ distinct candidate actions in one phrase (e.g. "evacuate and warn"), declare a tie!
    if len(detected_candidates) > 1:
        # Check if one is a modifier of another (e.g. transport with vulnerable or evacuation with boats)
        if set(detected_candidates) == {"order_evacuation", "assign_transport"}:
            pass  # prioritize transport if transport words are prominent
        elif set(detected_candidates) == {"prioritize_vulnerable", "assign_transport"}:
            pass
        elif set(detected_candidates) == {"order_evacuation", "prioritize_vulnerable"}:
            pass
        elif set(detected_candidates) == {"search_and_rescue", "prioritize_vulnerable"}:
            has_vulnerable = False  # rescue teams already take vulnerable residents first
        elif set(detected_candidates) == {"search_and_rescue", "order_evacuation"}:
            has_evacuate = False
        else:
            return "clarify", None, {
                "question": f"Multiple actions detected ({', '.join(detected_candidates)}). Only one action is permitted per tick. Please choose which one to execute:",
                "options": [
                    {"name": c, "params": ({"zone": detected_zone} if detected_zone and c in ZONE_ACTIONS else {})}
                    for c in detected_candidates[:4]
                ],
            }, None

    # 1. Action: wait / observe
    if has_wait:
        act = Action(name=ActionName.WAIT, params={})
        return "ok", act, None, None

    # 1b. Recovery actions (Part 2)
    recovery_route = [
        (has_search, "search_and_rescue", True),
        (has_clear_roads, "clear_roads", True),
        (has_survey, "damage_survey", True),
        (has_return, "return_residents", True),
        (has_clean_water, "provide_clean_water", False),
        (has_medical, "run_medical_camp", False),
        (has_power, "restore_power", False),
        (has_supplies, "distribute_supplies", False),
    ]
    for flag, name, needs_zone in recovery_route:
        if not flag:
            continue
        if needs_zone and not detected_zone:
            return "clarify", None, {
                "question": RECOVERY_ZONE_QUESTIONS[name],
                "options": [{"name": name, "params": {"zone": z}} for z in sorted(state.zones.keys())],
            }, None
        params = {"zone": detected_zone} if needs_zone else {}
        act = Action(name=ActionName(name), params=params)
        valid, reason = validate_action_preconditions(state, act)
        if not valid:
            return "rejected", None, None, reason
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
        "options": _default_options(state),
    }, None


ZONE_ACTIONS = {
    "order_evacuation", "issue_warning", "prioritize_vulnerable",
    "search_and_rescue", "clear_roads", "damage_survey", "return_residents",
}

RECOVERY_ZONE_QUESTIONS = {
    "search_and_rescue": "Which ward should the search and rescue teams go to?",
    "clear_roads": "Which ward's road should be cleared?",
    "damage_survey": "Which ward should engineers survey?",
    "return_residents": "Which ward's residents should return home?",
}


def _default_options(state: State) -> List[Dict[str, Any]]:
    if state.phase == "recovery":
        return [
            {"name": "provide_clean_water", "params": {}},
            {"name": "run_medical_camp", "params": {}},
            {"name": "search_and_rescue", "params": {"zone": "ward-1"}},
            {"name": "distribute_supplies", "params": {}},
            {"name": "wait", "params": {}},
        ]
    return [
        {"name": "issue_warning", "params": {}},
        {"name": "order_evacuation", "params": {"zone": "ward-1"}},
        {"name": "open_shelter", "params": {"shelter_id": "school"}},
        {"name": "reinforce_embankment", "params": {"sandbags": 100}},
        {"name": "wait", "params": {}},
    ]
