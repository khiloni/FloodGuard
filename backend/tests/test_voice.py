"""Sarvam voice endpoints: off without a key, two different speakers, speech -> English text."""
import base64

import httpx
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services import voice


class FakeResp:
    def __init__(self, status, data):
        self.status_code, self._data, self.text = status, data, ""

    def json(self):
        return self._data


def test_voice_is_off_without_key(monkeypatch):
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    c = TestClient(app)
    assert c.get("/api/v1/meta").json()["voice_provider"] == "browser"
    assert c.post("/api/v1/voice/speak", json={"text": "hello"}).status_code == 503


def test_speak_uses_language_and_distinct_speakers(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "test-key")
    voice._cache.clear()
    calls = []

    def fake_post(url, json=None, headers=None, timeout=None, **kw):
        calls.append((url, json, headers))
        return FakeResp(200, {"audios": [base64.b64encode(b"RIFF").decode()]})
    monkeypatch.setattr(httpx, "post", fake_post)
    c = TestClient(app)
    assert c.get("/api/v1/meta").json()["voice_provider"] == "sarvam"
    r1 = c.post("/api/v1/voice/speak", json={"text": "नदी का स्तर बढ़ रहा है।", "language": "hi", "role": "narrator"})
    r2 = c.post("/api/v1/voice/speak", json={"text": "आदेश: चेतावनी जारी करें", "language": "hi", "role": "command"})
    r3 = c.post("/api/v1/voice/speak", json={"text": "Order: Issue warning", "language": "gu", "role": "command"})
    assert r1.status_code == r2.status_code == r3.status_code == 200
    assert calls[0][0].endswith("/text-to-speech") and calls[0][2]["api-subscription-key"] == "test-key"
    assert calls[0][1]["language_code"] == "hi-IN" and calls[2][1]["language_code"] == "en-IN"
    assert calls[0][1]["speaker"] != calls[1][1]["speaker"]


def test_listen_translates_to_english(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "test-key")
    seen = {}

    def fake_post(url, files=None, data=None, headers=None, timeout=None, **kw):
        seen.update(url=url, data=data)
        return FakeResp(200, {"transcript": "Evacuate ward 1", "language_code": "gu-IN"})
    monkeypatch.setattr(httpx, "post", fake_post)
    c = TestClient(app)
    r = c.post("/api/v1/voice/listen", json={"audio_b64": base64.b64encode(b"\x1aE\xdf\xa3audio").decode(), "mime": "audio/webm", "language": "gu"})
    assert r.status_code == 200 and r.json()["transcript"] == "Evacuate ward 1"
    assert seen["url"].endswith("/speech-to-text") and seen["data"]["mode"] == "translate"
    assert c.post("/api/v1/voice/listen", json={"audio_b64": "not base64!"}).status_code == 503
