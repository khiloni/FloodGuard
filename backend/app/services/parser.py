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

    # Detect Zone (scenario-aware: the river village keeps its ward phrases)
    detected_zone = _detect_zone(clean, state)
    zone_ids = list(state.zones.keys())  # scenario order

    # Extract numbers (e.g. sandbags or boats)
    numbers = [int(n) for n in re.findall(r"\b\d+\b", clean)]

    # Detect candidate actions
    has_wait = any(w in clean for w in [
        "wait", "do nothing", "observe", "pass turn", "hold", "intezar", "roko", "thahro", "ruk jao", "stand by"
    ])
    has_shelter = (any(w in clean for w in [
        "shelter", "sheltar", "shlter", "school", "shool", "community hall", "hall"
    ]) or _detect_shelter(clean, state, strict=True) is not None) and any(w in clean for w in ["open", "unlock", "prep", "activate", "kholo", "start", "tayyar"])

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
    # Outside help and scenario mechanics
    has_support = any(w in clean for w in [
        "outside help", "external support", "request support", "ask the district", "reinforcements",
        "more resources", "convoy", "request help from the district", "sdrf", "bahar se madad",
    ])
    has_drains = any(w in clean for w in ["drain", "nala", "naali", "nali", "gutter"])
    has_release = any(w in clean for w in [
        "staggered", "slow the release", "delay the release", "reduce the release", "release slowly",
        "dam authority", "slower release", "stagger the release",
    ])
    has_recall = any(w in clean for w in [
        "recall", "fishing boat", "fishermen", "fishers", "call back the boats", "bring the boats back",
        "boats back", "machhuare",
    ])
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
    if has_search or has_recall:
        has_transport = False  # boats are part of a rescue or recall order
    if has_drains:
        has_clear_roads = False
        has_evacuate = has_evacuate and not ("clear" in clean and not any(
            w in clean for w in ["evacuate", "evacuation", "evac", "move out", "nikalo", "hatao"]))
    if has_release:
        has_wait = False
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
    if has_support: detected_candidates.append("request_external_support")
    if has_drains: detected_candidates.append("clear_drains")
    if has_release: detected_candidates.append("request_staggered_release")
    if has_recall: detected_candidates.append("recall_fishing_boats")

    # "talk to / speak to / consult" means a conversation; a bare "ask"/"call" (also inside
    # words like "recall") gives way to a stronger action such as a support request.
    if "consult_npc" in detected_candidates and len(detected_candidates) > 1:
        if any(v in clean for v in ["talk to", "talk with", "speak to", "speak with", "consult", "baat karo", "baat"]) \
                and _detect_npc(clean, state) is not None:
            detected_candidates = ["consult_npc"]
            has_medical = has_support = has_release = has_recall = has_drains = False
            has_search = has_supplies = has_clean_water = has_power = has_survey = has_return = False
            has_wait = has_shelter = has_embankment = has_vulnerable = has_transport = has_evacuate = has_warn = False
            has_clear_roads = False
            has_npc = True
        else:
            detected_candidates = [c for c in detected_candidates if c != "consult_npc"]
            has_npc = False

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

    # 1b. Recovery and scenario actions
    recovery_route = [
        (has_support, "request_external_support", False),
        (has_drains, "clear_drains", True),
        (has_release, "request_staggered_release", False),
        (has_recall, "recall_fishing_boats", False),
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
                "options": [{"name": name, "params": {"zone": z}} for z in zone_ids],
            }, None
        params = {"zone": detected_zone} if needs_zone else {}
        act = Action(name=ActionName(name), params=params)
        valid, reason = validate_action_preconditions(state, act)
        if not valid:
            return "rejected", None, None, reason
        return "ok", act, None, None

    # 2. Action: open shelter
    if has_shelter:
        act = Action(name=ActionName.OPEN_SHELTER, params={"shelter_id": _detect_shelter(clean, state) or _first_shelter(state)})
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
                "options": [{"name": "prioritize_vulnerable", "params": {"zone": z}} for z in zone_ids],
            }, None
        act = Action(name=ActionName.PRIORITIZE_VULNERABLE, params={"zone": detected_zone})
        valid, reason = validate_action_preconditions(state, act)
        if not valid:
            return "rejected", None, None, reason
        return "ok", act, None, None

    # 5. Action: consult NPC / talk / discuss
    if has_npc:
        npc_id = _detect_npc(clean, state)
        if npc_id is None:
            return "clarify", None, {
                "question": "Who would you like to consult?",
                "options": [{"name": "consult_npc", "params": {"npc_id": n}} for n in state.npc_ids],
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
                "options": [{"name": "assign_transport", "params": {"zone": z, "transport_type": ttype, "count": count}}
                            for z in zone_ids],
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
                "options": [{"name": "order_evacuation", "params": {"zone": z}} for z in zone_ids],
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
    "clear_drains": "Which area's drains should be cleared?",
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
            {"name": "search_and_rescue", "params": {"zone": sorted(state.zones)[0]}},
            {"name": "distribute_supplies", "params": {}},
            {"name": "wait", "params": {}},
        ]
    return [
        {"name": "issue_warning", "params": {}},
        {"name": "order_evacuation", "params": {"zone": sorted(state.zones)[0]}},
        {"name": "open_shelter", "params": {"shelter_id": _first_shelter(state)}},
        {"name": "reinforce_embankment", "params": {"sandbags": 100}},
        {"name": "wait", "params": {}},
    ]


VILLAGE_ZONE_PHRASES = {
    "ward-1": ["ward 1", "ward-1", "ward1", "lowland", "hamlet", "first ward", "ward ek", "ward number 1"],
    "ward-2": ["ward 2", "ward-2", "ward2", "market", "second ward", "ward do", "ward number 2"],
    "ward-3": ["ward 3", "ward-3", "ward3", "ridge", "highland", "third ward", "ward teen", "ward number 3"],
}

_GENERIC_WORDS = {"ward", "zone", "area", "the", "and", "village", "settlement", "colony", "road"}
_ORDINALS = ["first", "second", "third", "fourth", "fifth"]


def _zone_phrases(state: State) -> List[Tuple[str, List[str]]]:
    if set(state.zones) <= set(VILLAGE_ZONE_PHRASES):
        return [(z, VILLAGE_ZONE_PHRASES[z]) for z in sorted(state.zones)]
    out = []
    for i, zid in enumerate(state.zones):
        z = state.zones[zid]
        words = [w for w in re.findall(r"[a-z]+", z.name.lower()) if len(w) >= 4 and w not in _GENERIC_WORDS]
        phrases = [zid, zid.replace("-", " "), z.name.lower(), *words,
                   f"zone {i + 1}", f"area {i + 1}", f"ward {i + 1}"]
        if i < len(_ORDINALS):
            phrases.append(f"{_ORDINALS[i]} zone")
        out.append((zid, phrases))
    return out


def _detect_zone(clean: str, state: State) -> Optional[str]:
    for zid, phrases in _zone_phrases(state):
        if any(p in clean for p in phrases):
            return zid
    return None


def _first_shelter(state: State) -> str:
    closed = [sid for sid in sorted(state.shelters) if not state.shelters[sid].is_open]
    return (closed or sorted(state.shelters) or ["school"])[0]


def _detect_shelter(clean: str, state: State, strict: bool = False) -> Optional[str]:
    for sid in sorted(state.shelters):
        name = state.shelters[sid].name.lower()
        words = [w for w in re.findall(r"[a-z]+", name) if len(w) >= 4 and w not in {"shelter", "purpose", "multi"}]
        if sid in clean or sid.replace("-", " ") in clean or name in clean:
            return sid
        if not strict and any(w in clean for w in words):
            return sid
    return None


_NPC_PHRASES = [
    ("district_official", ["district", "official", "collector", "magistrate", "control room", "liaison", "desai",
                           "kulkarni", "iyer", "mr. rao", "mr rao", "sdm"]),
    ("health_worker", ["nurse", "doctor", "health worker", "asha", "kavita", "mehta", "meena", "thomas", "dr."]),
    ("village_head", ["sarpanch", "head", "mukhiya", "ramesh", "pradhan", "councillor", "fatima", "lakshmi", "ganesh"]),
    ("rescue_worker", ["officer", "sunita", "worker", "ndrf", "volunteer", "fire", "raju", "constable", "imran",
                       "coast guard", "joseph"]),
    ("family_member", ["mohan", "family", "resident", "parivar", "anita", "gopal", "savita"]),
]


def _detect_npc(clean: str, state: State) -> Optional[str]:
    for npc_id, words in _NPC_PHRASES:
        if npc_id in state.npc_ids and any(w in clean for w in words):
            return npc_id
    return None
