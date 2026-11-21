import os
import re
from typing import List, Set, Dict, Any, Tuple
import yaml

from ..engine.models import Event, EventType

CURR_DIR = os.path.dirname(os.path.abspath(__file__))
TONE_FILE = os.path.join(CURR_DIR, "tone.yaml")

DISALLOWED_WORDS: Set[str] = set()
if os.path.exists(TONE_FILE):
    with open(TONE_FILE, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
        DISALLOWED_WORDS = set(data.get("disallowed_words", []))


def extract_numbers(text: str) -> Set[int]:
    """Extract integer numbers found in the text string."""
    matches = re.findall(r"\b\d+\b", text)
    return {int(m) for m in matches}


class GuardrailValidator:
    def __init__(self, allowed_names: Set[str]):
        self.allowed_names = {name.lower() for name in allowed_names}
        # Add basic role/system names
        self.allowed_names.update({
            "sarpanch", "ramesh", "officer", "sunita", "mohan", "mukhiya",
            "ward", "ward-1", "ward-2", "ward-3", "school", "ndrf", "india"
        })

    def validate_text(
        self,
        text: str,
        facts_allowed: Set[int],
        events_this_turn: List[Event],
        cited_cards: List[str] = None,
    ) -> Tuple[bool, List[str]]:
        """Validate candidate narration or NPC text against guardrail rules.
        Returns (passed, violations).
        """
        violations: List[str] = []
        lower_text = text.lower()

        # 1. Tone check
        for word in DISALLOWED_WORDS:
            if re.search(r"\b" + re.escape(word) + r"\b", lower_text):
                violations.append(f"Disallowed graphic vocabulary detected: '{word}'")

        # 2. Numbers check
        extracted_nums = extract_numbers(text)
        # Filter out trivial/common conversational numbers like 1, 2, 3 or percentages if appropriate
        for num in extracted_nums:
            if num not in facts_allowed:
                violations.append(f"Unsupported number {num} cited without basis in facts_allowed.")

        # 3. Outcome claims verification
        casualty_events = any(e.type == EventType.CASUALTY_OCCURRED for e in events_this_turn)
        casualty_words = ["died", "drowned", "dead", "fatalities", "perished", "casualty", "casualties"]
        for cw in casualty_words:
            if re.search(r"\b" + re.escape(cw) + r"\b", lower_text) and not casualty_events:
                violations.append(f"Casualty claim '{cw}' made without corresponding CASUALTY_OCCURRED event.")

        rescue_events = any(e.type in (EventType.RESIDENTS_EVACUATED, EventType.VULNERABLE_EVACUATED) for e in events_this_turn)
        rescue_words = ["evacuated", "rescued", "transported to safety"]
        for rw in rescue_words:
            if re.search(r"\b" + re.escape(rw) + r"\b", lower_text) and not rescue_events:
                violations.append(f"Rescue claim '{rw}' made without corresponding evacuation event this tick.")

        # 4. Mandatory safety advice constraint
        advice_markers = ["you must", "you should always", "never do this", "official advice is"]
        for am in advice_markers:
            if am in lower_text and not cited_cards:
                violations.append(f"Safety directive '{am}' offered without citing official rule cards.")

        passed = len(violations) == 0
        return passed, violations
