"""Natural Indian-language voices through Sarvam AI (optional).

Speaking: POST https://api.sarvam.ai/text-to-speech (model bulbul:v3), two different speakers so the
narrator and the read-back of your orders never sound alike.
Listening: POST https://api.sarvam.ai/speech-to-text (model saaras:v4, mode=translate) turns speech
in any supported Indian language into English text for the order parser.

Enabled only when SARVAM_API_KEY is set. Keys are read from the environment, never logged, and
nothing is stored: audio is passed through and discarded. Without a key the browser's own voices
are used instead.
"""
import base64
import hashlib
import logging
import os
from collections import OrderedDict
from typing import Dict, Optional, Tuple

import httpx

logger = logging.getLogger("floodguard.voice")

BASE = os.environ.get("SARVAM_BASE_URL", "https://api.sarvam.ai").rstrip("/")
TTS_MODEL = os.environ.get("SARVAM_TTS_MODEL", "bulbul:v3")
STT_MODEL = os.environ.get("SARVAM_STT_MODEL", "saaras:v4")
SPEAKERS = {
    "narrator": os.environ.get("SARVAM_NARRATOR_SPEAKER", "priya"),
    "command": os.environ.get("SARVAM_COMMAND_SPEAKER", "rahul"),
}
LANG_CODES = {"en": "en-IN", "hi": "hi-IN", "gu": "gu-IN", "mr": "mr-IN", "bn": "bn-IN",
              "ta": "ta-IN", "te": "te-IN", "kn": "kn-IN"}
MAX_CHARS = 1200
MAX_AUDIO_BYTES = 2_000_000  # about 30 s of compressed speech
TIMEOUT = float(os.environ.get("SARVAM_VOICE_TIMEOUT", "20"))

_cache: "OrderedDict[str, str]" = OrderedDict()  # tiny LRU of spoken lines (base64 wav)


def enabled() -> bool:
    return bool(os.environ.get("SARVAM_API_KEY"))


def _headers() -> Dict[str, str]:
    return {"api-subscription-key": os.environ.get("SARVAM_API_KEY", "")}


def speak(text: str, language: str, role: str = "narrator") -> Tuple[Optional[str], Optional[str]]:
    """Return (base64 WAV, error). Text is the line already in the chosen language."""
    if not enabled():
        return None, "voice service not configured"
    text = (text or "").strip()[:MAX_CHARS]
    if not text:
        return None, "empty text"
    lang = LANG_CODES.get((language or "en").split("-")[0], "en-IN")
    # English text (fixed template lines) is read in Indian English.
    if all(ord(c) < 0x0250 for c in text if c.isalpha()):
        lang = "en-IN"
    speaker = SPEAKERS.get(role, SPEAKERS["narrator"])
    key = hashlib.sha256(f"{lang}|{speaker}|{text}".encode()).hexdigest()
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key], None
    body = {"text": text, "language_code": lang, "model": TTS_MODEL, "speaker": speaker,
            "pace": 1.08 if role == "command" else 1.0, "enable_preprocessing": True}
    try:
        r = httpx.post(f"{BASE}/text-to-speech", json=body, headers=_headers(), timeout=TIMEOUT)
        if r.status_code != 200:
            logger.warning("sarvam tts %s: %s", r.status_code, r.text[:200])
            return None, f"voice service error {r.status_code}"
        audio = (r.json().get("audios") or [None])[0]
        if not audio:
            return None, "no audio returned"
    except httpx.HTTPError as exc:
        logger.warning("sarvam tts failed: %s", type(exc).__name__)
        return None, "voice service unreachable"
    _cache[key] = audio
    if len(_cache) > 200:
        _cache.popitem(last=False)
    return audio, None


def listen(audio_b64: str, mime: str, language: str) -> Tuple[Optional[Dict[str, str]], Optional[str]]:
    """Speech in any supported language -> English transcript for the order parser."""
    if not enabled():
        return None, "voice service not configured"
    try:
        audio = base64.b64decode(audio_b64, validate=True)
    except Exception:
        return None, "invalid audio"
    if not audio or len(audio) > MAX_AUDIO_BYTES:
        return None, "audio too long or empty"
    ext = "webm" if "webm" in mime else "ogg" if "ogg" in mime else "mp4" if "mp4" in mime else "wav"
    files = {"file": (f"speech.{ext}", audio, mime or "audio/webm")}
    data = {"model": STT_MODEL, "mode": "translate"}
    try:
        r = httpx.post(f"{BASE}/speech-to-text", files=files, data=data, headers=_headers(), timeout=TIMEOUT)
        if r.status_code != 200:
            logger.warning("sarvam stt %s: %s", r.status_code, r.text[:200])
            return None, f"voice service error {r.status_code}"
        j = r.json()
    except httpx.HTTPError as exc:
        logger.warning("sarvam stt failed: %s", type(exc).__name__)
        return None, "voice service unreachable"
    return {"transcript": (j.get("transcript") or "").strip(), "language_code": j.get("language_code") or ""}, None
