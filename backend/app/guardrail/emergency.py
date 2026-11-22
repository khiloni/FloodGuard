import re

EMERGENCY_PATTERNS = [
    r"\bi\s+am\s+(actually|really)\s+(trapped|drowning|stranded)\b",
    r"\bmy\s+(house|home|street|village)\s+is\s+(actually\s+)?flooding\s+(now|right\s+now)\b",
    r"\breal(\s+life)?\s+flood\b",
    r"\breal\s+emergency\b",
    r"\bhelp\s+me\s+i('m|\s+am)\s+in\s+danger\b",
    r"\b(call|dial|phone|ring|contact)\s+(?:the\s+)?(112|1078|100|108|police|ambulance|ndrf|disaster\s+helpline|emergency\s+(?:services|helpline|number))\b",
    r"\b(112|1078)\b",
    r"\bsomeone\s+is\s+actually\s+dying\b",
    r"\bthis\s+is\s+not\s+a\s+game.*help\b",
]

COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in EMERGENCY_PATTERNS]

EMERGENCY_RESPONSE_MESSAGE = (
    "EMERGENCY ADVISORY: If you or someone near you is in real danger from flooding, "
    "immediately disconnect from this educational simulation and call the official India "
    "Emergency Helpline at 112 or Disaster Helpline at 1078. Move to the highest accessible ground "
    "and follow instructions broadcast by local civil defence and disaster management authorities."
)


def detect_real_emergency(text: str) -> bool:
    """Detect whether player input indicates an actual real-world emergency."""
    if not text:
        return False
    clean = text.strip()
    return any(p.search(clean) is not None for p in COMPILED_PATTERNS)
