"""Every sentence the API can send has a translation in every language catalogue, and every
translation keeps all the numbers and names of its English sentence."""
import functools
import os
import re

import pytest
from fastapi.testclient import TestClient

from backend.app import i18n
from backend.app.main import app

AVAILABLE = [lang for lang in i18n.LANGS if os.path.exists(os.path.join(i18n.HERE, f"{lang}.yaml"))]
PLACEHOLDER = re.compile(r"\{[npq]\d+\}")


@functools.lru_cache(maxsize=None)
def harvested():
    from backend.scripts.harvest_text import harvest
    return tuple(harvest(seeds=2))


@pytest.mark.parametrize("lang", AVAILABLE)
def test_catalogue_placeholders_match(lang):
    cat = i18n.catalog(lang)
    for en, tr in cat["sentences"].items():
        assert sorted(PLACEHOLDER.findall(en)) == sorted(PLACEHOLDER.findall(str(tr))), (lang, en, tr)


@pytest.mark.parametrize("lang", AVAILABLE)
def test_every_name_and_story_is_translated(lang):
    cat = i18n.catalog(lang)
    missing = sorted(set(i18n.english_names().values()) - set(cat["names"]))
    assert not missing, (lang, missing[:20])
    ids = {f[:-5] for f in os.listdir("scenarios") if f.endswith(".yaml")}
    assert ids <= set(cat["scenarios"]), (lang, ids - set(cat["scenarios"]))
    assert len(cat["rulecards"]) >= 14


@pytest.mark.parametrize("lang", AVAILABLE)
def test_every_api_sentence_is_translated(lang):
    untranslated = set()
    for text in harvested():
        for s in i18n.split_sentences(text):
            if i18n.translate_sentence(s, lang) is None:
                untranslated.add(i18n.to_pattern(s)[0])
    assert not untranslated, (lang, sorted(untranslated)[:25])


def test_session_in_hindi_is_translated_end_to_end():
    if "hi" not in AVAILABLE:
        pytest.skip("no Hindi catalogue")
    c = TestClient(app)
    listing = c.get("/api/v1/scenarios", params={"language": "hi"}).json()["scenarios"]
    assert listing[0]["name"] == "नदी किनारे गाँव में बाढ़ राहत"
    s = c.post("/api/v1/sessions", json={"scenario_id": "village-river-01", "seed": 4, "language": "hi"}).json()
    assert any(z["name"].startswith("वार्ड") for z in s["layout"]["zones"])
    r = c.post(f"/api/v1/sessions/{s['session_id']}/turns",
               json={"input": {"type": "button", "action": {"name": "open_shelter", "params": {"shelter_id": "school"}}}}).json()
    assert re.search(r"[ऀ-ॿ]", r["narration"]["text"]), r["narration"]["text"]
    assert r["state"]["zones"]["ward-1"]["name"] == "Ward 1 (Lowland Riverside)"  # engine state stays English
    en = c.post("/api/v1/sessions", json={"scenario_id": "village-river-01", "seed": 4}).json()
    assert en["layout"]["zones"][0]["name"] == "Ward 1 (Lowland Riverside)"
