import os
import re
import unicodedata
from typing import List, Set, Dict, Any, Tuple, Optional, Union
import yaml

from ..engine.models import Event, EventType

CURR_DIR = os.path.dirname(os.path.abspath(__file__))
TONE_FILE = os.path.join(CURR_DIR, "tone.yaml")

NUM_RE = re.compile(
    r"(?<!\w)-?\d+(?:\.\d+)?[eE][+-]?\d+(?!\w)"
    r"|(?<!\w)-?\d+(?:,\d+)*(?:\.\d+)?[kKmMbB](?!\w)"
    r"|(?<!\w)-?\d+(?:_\d+)+(?:\.\d+)?(?!\w)"
    r"|(?<![A-Za-z0-9_-])-?[1-9]\d{0,2}(?: \d{3})+(?:\.\d+)?(?!\w)"
    r"|(?<!\w)-(?:\d+(?:,\d+)*(?:\.\d+)?|\.\d+)|\d+(?:,\d+)*(?:\.\d+)?|(?<!\d)\.\d+"
)

_SUFFIX_MULT = {"k": 1_000, "m": 1_000_000, "b": 1_000_000_000}

_GROUP_NOUNS = r"(?:residents|villagers|citizens|people|families|elders|children|locals|inhabitants|persons)"
_SINGLE_NOUNS = r"(?:resident|villager|citizen|person|family|elder|child|local|inhabitant)"
_COMMUNITY_NOUNS = r"(?:village|town|community|population|ward|settlement|area)"
_PREP_QUALIFIER = r"(?:\s+(?:in|of|from|across)\s+(?:the\s+)?[\w,-]+(?:\s+[\w,-]+){0,8})?"
_AUX_VERBS = r"(?:has\s+|have\s+|is\s+|are\s+|was\s+|were\s+|will\s+be\s+|remained\s+|stayed\s+)?"
_SURVIVAL_OUTCOME = (
    r"(?:survived|saved|safe|unharmed|out\s+of\s+danger|made\s+it\s+out\s+alive|escaped\s+unharmed)"
)

UNCONDITIONAL_SURVIVAL_PATTERNS = [
    re.compile(
        rf"\b(?:everyone|everybody|"
        rf"every\s+(?:single\s+)?{_SINGLE_NOUNS}|"
        rf"all\s+(?:of\s+the\s+)?(?:\d+\s+)?{_GROUP_NOUNS}|"
        rf"(?:the\s+)?(?:entire|whole)\s+{_COMMUNITY_NOUNS}|"
        rf"no\s+one|nobody)"
        rf"{_PREP_QUALIFIER}\s+{_AUX_VERBS}{_SURVIVAL_OUTCOME}\b",
        re.IGNORECASE,
    ),
    re.compile(
        rf"\b(?:all\s+(?:are\s+)?(?:safe|survived|saved|unharmed|made\s+it\s+out\s+alive)|"
        rf"everyone'?s\s+safe|everybody'?s\s+safe|"
        rf"100\s*(?:%|percent)\s+(?:of\s+(?:the\s+)?\w+\s+)?{_AUX_VERBS}(?:safe|saved|survived|evacuated|rescued))\b",
        re.IGNORECASE,
    ),
    re.compile(
        rf"\b(?:no|zero|not\s+a\s+single|none\s+of\s+the)\s+"
        rf"(?:casualties|fatalities|deaths|losses|lives\s+(?:(?:were|have\s+been|had\s+been|are)\s+)?lost|"
        rf"(?:{_SINGLE_NOUNS}|{_GROUP_NOUNS}|one)\s+(?:died|drowned|perished|was\s+lost|were\s+lost|was\s+killed|were\s+killed|(?:was|were|got)\s+(?:injured|harmed)|lost\s+their\s+life|lost\s+their\s+lives))\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:nobody|no\s+one)\s+(?:died|drowned|perished|was\s+lost|was\s+killed|was\s+injured|was\s+harmed|lost\s+(?:their|a)\s+life)\b",
        re.IGNORECASE,
    ),
]

CONDITIONAL_RESCUE_PATTERNS = [
    re.compile(r"\bsurvived\b", re.IGNORECASE),
    re.compile(r"\b(?:residents|villagers|families|people|citizens)\s+(?:are|were)\s+(?:safe|saved)\b", re.IGNORECASE),
    re.compile(r"\bsafely\s+(?:evacuated|rescued|relocated|sheltered)\b", re.IGNORECASE),
    re.compile(r"\b(?:evacuated|rescued)\s+safely\b", re.IGNORECASE),
]

MARKDOWN_URL_PATTERNS = [
    ("markdown bold/italic", re.compile(r"\*\*|__")),
    ("markdown single-asterisk italic", re.compile(r"(?<!\w)\*[^*\n]+\*(?!\w)")),
    ("markdown single-underscore italic", re.compile(r"(?<![A-Za-z0-9_])_[^_\n]+_(?![A-Za-z0-9_])")),
    ("markdown strikethrough", re.compile(r"~~[^~\n]+~~")),
    ("markdown blockquote", re.compile(r"(?m)^\s*>\s*\S")),
    ("markdown horizontal rule", re.compile(r"(?m)^\s*---+\s*$")),
    ("markdown code/backtick", re.compile(r"`")),
    ("markdown heading", re.compile(r"(?m)^\s{0,3}#{1,6}\s+")),
    ("markdown bullet list", re.compile(r"(?m)^\s*[-*+•]\s+\S")),
    ("markdown numbered list", re.compile(r"(?m)^\s*\d+\.(?:\s+\S|[A-Za-z])")),
    ("markdown link", re.compile(r"!?\[[^\]]+\]\([^)]+\)")),
    ("URL", re.compile(r"(?i)(?:https?://|ftp://|\bwww\.|\b[a-z0-9-]+\.(?:com|org|net|in|gov|edu|io|ly|co|info|biz|me|app)\b(?:/\S*)?)")),
]

PROMPT_LEAKAGE_TOKENS = (
    "<<<",
    ">>>",
    "PLAYER_INPUT",
    "END_INPUT",
    "ALLOWED_NUMBERS",
    "RIVER_LEVEL_CM",
    "RULE_CARDS",
    "PLAYER_MESSAGE",
    "RULES (mandatory)",
)

PROMPT_INJECTION_PATTERNS = [
    re.compile(r"\bsystem\s+override\b", re.IGNORECASE),
    re.compile(r"\bignore\s+(?:all\s+)?(?:previous|prior)\s+instructions\b", re.IGNORECASE),
    re.compile(r"\bdisregard\s+(?:all\s+|the\s+)?(?:rules|previous|prior|instructions)\b", re.IGNORECASE),
    re.compile(r"\bsimulation\s+rules\s+are\s+suspended\b", re.IGNORECASE),
    re.compile(r"\brules\s+are\s+suspended\b", re.IGNORECASE),
    re.compile(r"\byou\s+are\s+now\s+dan\b", re.IGNORECASE),
    re.compile(r"\bconfidential\s+system\s+prompt\b", re.IGNORECASE),
    re.compile(r"\badministrator\s+privileges\b", re.IGNORECASE),
]

NON_ENGLISH_STOPWORDS = {
    "es": {
        "el", "la", "las", "los", "del", "una", "en", "con", "por", "para", "que",
        "está", "están", "río", "agua", "subió", "sube", "alcanzó", "inundación",
        "evacuación", "refugio", "alerta", "pueblo", "aldea", "rápido",
    },
    "fr": {
        "le", "la", "les", "des", "du", "au", "aux", "dans", "avec", "sur", "et", "est", "sont",
        "une", "eau", "rivière", "niveau", "inondation", "évacuation", "abri",
        "monte", "courant", "rapide", "maintenant", "à",
    },
    "de": {
        "der", "das", "und", "ist", "sind", "nicht", "mit", "für", "eine", "einer", "einem",
        "wasser", "fluss", "überschwemmung", "evakuierung", "achtung", "vor", "starkem",
        "regen", "heute", "hochwasser", "dorf", "jetzt",
    },
    "pt": {
        "água", "rio", "subiu", "enchente", "inundação", "evacuação", "abrigo",
        "alerta", "nível", "vila", "aldeia", "moradores", "rapidamente", "para",
        "não", "são", "está", "estão", "uma", "das", "dos", "nas", "nos",
    },
    "hi-latn": {
        "nadi", "paani", "pani", "badh", "raha", "rahi", "rahe", "hai", "hain",
        "sab", "jaldi", "niklo", "nikalo", "bachao", "baandh", "gaon",
        "ka", "ki", "ke", "ko", "mein", "abhi", "chalo", "bhejo", "karo",
    },
}


def get_disallowed_words() -> Set[str]:
    if os.path.exists(TONE_FILE):
        with open(TONE_FILE, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
            return set(data.get("disallowed_words", []))
    return set()


def extract_numbers(text: str) -> Set[Union[int, float]]:
    """Extract integer, decimal, grouped, suffix, and scientific numbers from text."""
    nums: Set[Union[int, float]] = set()
    for match in NUM_RE.findall(text):
        clean = match.replace(",", "").replace("_", "").replace(" ", "")
        lower = clean.lower()
        if lower[-1:] in _SUFFIX_MULT:
            val = float(lower[:-1]) * _SUFFIX_MULT[lower[-1]]
            nums.add(int(val) if val.is_integer() else val)
        elif "e" in lower:
            val = float(lower)
            nums.add(int(val) if val.is_integer() else val)
        elif "." in clean:
            nums.add(float(clean))
        else:
            nums.add(int(clean))
    return nums


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
        cited_cards: Optional[List[str]] = None,
        language: str = "en",
    ) -> Tuple[bool, List[str]]:
        """Validate candidate narration or NPC text against guardrail rules.
        Returns (passed, violations).
        """
        if not text or not text.strip():
            return False, ["Empty text output."]

        violations: List[str] = []
        lower_text = text.lower()

        # 1. Tone check
        disallowed = get_disallowed_words()
        for word in disallowed:
            if re.search(r"\b" + re.escape(word) + r"\b", lower_text):
                violations.append(f"Disallowed graphic vocabulary detected: '{word}'")

        # 2. Numbers check
        extracted_nums = extract_numbers(text)
        for num in extracted_nums:
            if num not in facts_allowed:
                violations.append(f"Unsupported number {num} cited without basis in facts_allowed.")

        # 3. Outcome claims verification
        casualty_events = any(e.type == EventType.CASUALTY_OCCURRED for e in events_this_turn)
        casualty_words = ["died", "drowned", "dead", "fatalities", "perished", "casualty", "casualties", "bodies", "body"]
        for cw in casualty_words:
            if re.search(r"\b" + re.escape(cw) + r"\b", lower_text) and not casualty_events:
                violations.append(f"Casualty claim '{cw}' made without corresponding CASUALTY_OCCURRED event.")

        for pat in UNCONDITIONAL_SURVIVAL_PATTERNS:
            if pat.search(text):
                violations.append("Ungrounded universal survival or all-safe claim is disallowed.")
                break

        rescue_events = any(e.type in (EventType.RESIDENTS_EVACUATED, EventType.VULNERABLE_EVACUATED, EventType.SEARCH_AND_RESCUE_COMPLETED) for e in events_this_turn)
        rescue_words = ["evacuated", "rescued", "transported to safety"]
        for rw in rescue_words:
            if re.search(r"\b" + re.escape(rw) + r"\b", lower_text) and not rescue_events:
                violations.append(f"Rescue claim '{rw}' made without corresponding evacuation event this tick.")

        if not rescue_events:
            for pat in CONDITIONAL_RESCUE_PATTERNS:
                if pat.search(text):
                    violations.append("Ungrounded rescue/survival claim made without corresponding evacuation event this tick.")
                    break

        # 4. Mandatory safety advice constraint
        advice_markers = ["you must", "you should always", "never do this", "official advice is"]
        for am in advice_markers:
            if am in lower_text and not cited_cards:
                violations.append(f"Safety directive '{am}' offered without citing official rule cards.")

        # 5. Plain-text format check (no markdown or URLs)
        for label, pat in MARKDOWN_URL_PATTERNS:
            if pat.search(text):
                violations.append(f"Disallowed {label} formatting detected.")

        # 6. Prompt-injection and delimiter leakage check
        for token in PROMPT_LEAKAGE_TOKENS:
            if token.lower() in lower_text:
                violations.append(f"Prompt delimiter or instruction token leakage detected: '{token}'.")
        for pat in PROMPT_INJECTION_PATTERNS:
            if pat.search(text):
                violations.append("Prompt injection or system override phrase detected.")
                break

        # 7. Language verification
        lang = (language or "en").strip().lower().split("-")[0]
        alpha_chars = [ch for ch in text if ch.isalpha()]
        if lang == "en":
            if any(not unicodedata.name(ch, "").startswith("LATIN ") for ch in alpha_chars):
                violations.append("Wrong-language output: non-Latin script detected when English ('en') was requested.")
            else:
                tokens = set(re.findall(r"[a-zA-ZÀ-ÿ]+", lower_text))
                for foreign_lang, stopwords in NON_ENGLISH_STOPWORDS.items():
                    if len(tokens & stopwords) >= 2:
                        violations.append(f"Wrong-language output detected ({foreign_lang}) when English ('en') was requested.")
                        break
        elif lang == "hi":
            has_devanagari = any(unicodedata.name(ch, "").startswith("DEVANAGARI ") for ch in alpha_chars)
            has_other_script = any(
                not (
                    unicodedata.name(ch, "").startswith("DEVANAGARI ")
                    or unicodedata.name(ch, "").startswith("LATIN ")
                )
                for ch in alpha_chars
            )
            if has_other_script or not has_devanagari:
                violations.append("Wrong-language output: Hindi ('hi') output must contain Devanagari script.")

        passed = len(violations) == 0
        return passed, violations
