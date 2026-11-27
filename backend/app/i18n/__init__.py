"""Translation of everything the API sends, for sessions played in an Indian language.

The engine and its English text never change. For a session in another language, responses are
rewritten on the way out: each English sentence is matched against a catalogue of sentence
patterns and filled in again in the chosen language, with numbers and place or person names
carried across. The catalogue lives in `backend/app/i18n/<lang>.yaml`:

    names:      English proper name or role -> translated name (zones, shelters, characters, sites)
    sentences:  English pattern -> translated pattern. In a pattern, {n1}, {n2}... stand for the
                numbers of the sentence in order, and {p1}, {p2}... for its names, in order.
    scenarios:  story id -> name, hook, description, hazard_label, npc dialogue and roles
    rulecards:  id -> title, guidance

A sentence without a pattern stays in English; `backend/tests/test_i18n.py` replays every story
and fails if any sentence the API can send has no pattern. Text written by the AI in the chosen
language matches no English pattern and passes through unchanged.
"""
import functools
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
LANGS = ("hi", "gu", "mr", "bn", "ta", "te", "kn")

# Same split as the harvester: end of sentence followed by a capital letter.
_SPLIT = re.compile(r"(?<!Dr\.)(?<!Mr\.)(?<!Ms\.)(?<=[.!?])\s+(?=[A-Z'\"(])")
_NUM = re.compile(r"\d+")

# Response keys whose string values are prose to translate. Everything else (ids, action names,
# engine state) is left alone.
TEXT_KEYS = {"text", "description", "reject_reason", "question", "tradeoff", "explanation", "label",
             "hook", "initial_dialogue", "role", "guidance", "title", "message", "disclaimer",
             "hazard_label", "difficulty_label", "name", "category"}
SKIP_KEYS = {"state", "final_state", "parsed_action", "action", "params", "keywords", "guardrail",
             "source", "llm_mode", "id", "npc_id", "type", "zone", "target", "caused_by", "event_type"}


@functools.lru_cache(maxsize=None)
def catalog(lang: str) -> Dict[str, Any]:
    path = os.path.join(HERE, f"{lang}.yaml")
    if lang not in LANGS or not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    data.setdefault("names", {})
    data.setdefault("sentences", {})
    data.setdefault("scenarios", {})
    data.setdefault("rulecards", {})
    # longest names first so "Ward 1 (Lowland Riverside)" wins over "Ward 1"
    data["_name_order"] = sorted(data["names"], key=len, reverse=True)
    return data


@functools.lru_cache(maxsize=None)
def english_names() -> Dict[str, str]:
    """Every proper name, role, map label and internal id from the story files, mapped to the
    English display name it stands for (an id such as 'ward-1' maps to 'Ward 1 (Lowland Riverside)')."""
    import glob
    names: Dict[str, str] = {}
    root = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "scenarios")

    def add(n, display=None):
        if n and len(n) > 2:
            names.setdefault(n, display or n)
    for f in sorted(glob.glob(os.path.join(root, "*.yaml"))):
        with open(f, encoding="utf-8") as fh:
            c = yaml.safe_load(fh)
        lay = c.get("layout", {})
        for z in c.get("zones", []) + lay.get("zones", []):
            add(z["name"])
            add(re.sub(r" \(.*\)$", "", z["name"]))
            add(z["id"], z["name"])
        for sh in c.get("shelters", []) + lay.get("shelters", []):
            add(sh["name"])
            add(sh["id"], sh["name"])
        for n in c.get("npcs", []):
            add(n["name"])
            add(n["role"])
            add(n["id"], n["name"])
        add(c.get("name", ""))
        d = lay.get("decor", {}) or {}
        for key in ("jetty", "dam", "sea_boats", "lake"):
            if isinstance(d.get(key), dict):
                add(d[key].get("label"))
        for b in (d.get("bridges") or []) + (d.get("underpasses") or []):
            add(b.get("label"))
        for site in (lay.get("recovery_sites") or {}).values():
            add(site.get("label"))
        for seg in (lay.get("embankment") or {}).get("segments", []):
            add(seg.get("label"))
        for k in ("river", "embankment"):
            add((lay.get(k) or {}).get("name"))
    return names


def all_english_names() -> Tuple[str, ...]:
    return tuple(sorted(english_names(), key=len, reverse=True))


def to_pattern(sentence: str) -> Tuple[str, List[str], List[str]]:
    """English sentence -> (pattern, names, numbers). Names are found first (they can contain digits)."""
    found: List[Tuple[int, str]] = []
    masked = sentence
    for name in all_english_names():
        start = 0
        while True:
            i = masked.find(name, start)
            if i < 0:
                break
            before = masked[i - 1] if i > 0 else " "
            after = masked[i + len(name)] if i + len(name) < len(masked) else " "
            if before.isalnum() or after.isalnum() or before == "-" or after == "-":
                start = i + 1
                continue
            found.append((i, name))
            masked = masked[:i] + "\x00" * len(name) + masked[i + len(name):]
            start = i + len(name)
    found.sort()
    names = [n for _, n in found]
    numbers: List[str] = []

    def num(m):
        numbers.append(m.group(0))
        return f"{{n{len(numbers)}}}"
    masked = _NUM.sub(num, masked)
    k = [0]

    def nm(_m):
        k[0] += 1
        return f"{{p{k[0]}}}"
    pattern = re.sub("\x00+", nm, masked)
    return pattern, names, numbers


def split_sentences(text: str) -> List[str]:
    return [s for s in _SPLIT.split(text.strip()) if s]


def translate_name(name: str, lang: str) -> str:
    cat = catalog(lang)
    name = english_names().get(name, name)  # internal ids -> display name
    if name in cat.get("names", {}):
        return cat["names"][name]
    base = re.sub(r" \(.*\)$", "", name)
    return cat.get("names", {}).get(base, name)


def translate_sentence(sentence: str, lang: str) -> Optional[str]:
    cat = catalog(lang)
    if not cat:
        return None
    if sentence in cat["names"]:
        return cat["names"][sentence]
    if sentence in english_names():
        return translate_name(sentence, lang)
    pattern, names, numbers = to_pattern(sentence)
    tpl = cat["sentences"].get(pattern)
    quoted = None
    if tpl is None:
        # Echoed player text in quotes, e.g. Could not determine action from 'do something'.
        m = re.search(r"'([^']*)'", pattern)
        if m:
            quoted = m.group(1)
            tpl = cat["sentences"].get(pattern.replace(m.group(0), "'{q1}'"))
    if tpl is None:
        return None
    if quoted is not None:
        tpl = str(tpl).replace("{q1}", quoted)
    out = str(tpl)
    for k, n in enumerate(numbers, 1):
        out = out.replace(f"{{n{k}}}", n)
    for k, n in enumerate(names, 1):
        out = out.replace(f"{{p{k}}}", translate_name(n, lang))
    return out


def translate_text(text: str, lang: str) -> str:
    if not text or lang == "en" or not catalog(lang):
        return text
    whole = translate_sentence(text.strip(), lang)
    if whole is not None:
        return whole
    parts = []
    for s in split_sentences(text):
        t = translate_sentence(s, lang)
        parts.append(t if t is not None else s)
    return " ".join(parts)


def localize(obj: Any, lang: str, key: Optional[str] = None) -> Any:
    """Recursively translate the prose fields of an API payload."""
    if lang == "en" or not catalog(lang):
        return obj
    if isinstance(obj, dict):
        if str(obj.get("id", "")).startswith("RC-") and "guidance" in obj:
            return localize_rulecard(obj, lang)
        return {k: (v if k in SKIP_KEYS else localize(v, lang, k)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [localize(v, lang, key) for v in obj]
    if isinstance(obj, str) and key in TEXT_KEYS:
        return translate_text(obj, lang)
    return obj


def localize_scenario(info: Dict[str, Any], lang: str) -> Dict[str, Any]:
    """Story card and session layout: story text from the catalogue, then names and labels."""
    cat = catalog(lang)
    if not cat:
        return info
    sc = cat["scenarios"].get(info.get("id") or info.get("scenario_id"), {})
    out = dict(info)
    for k in ("name", "hook", "description", "hazard_label"):
        if sc.get(k):
            out[k] = sc[k]
    if "npcs" in out:
        npcs = []
        for n in out["npcs"]:
            m = dict(n)
            m["name"] = translate_name(n.get("name", ""), lang)
            m["role"] = translate_name(n.get("role", ""), lang)
            dlg = (sc.get("npcs") or {}).get(n.get("id"))
            if dlg:
                m["initial_dialogue"] = dlg
            npcs.append(m)
        out["npcs"] = npcs
    if "shelters" in out:
        out["shelters"] = [{**s, "name": translate_name(s.get("name", ""), lang)} for s in out["shelters"]]
    if "layout" in out and isinstance(out["layout"], dict):
        out["layout"] = localize_layout(out["layout"], lang)
    return out


def localize_layout(layout: Dict[str, Any], lang: str) -> Dict[str, Any]:
    if not catalog(lang) or not isinstance(layout, dict):
        return layout

    def walk(o):
        if isinstance(o, dict):
            return {k: (translate_name(v, lang) if k in ("name", "label") and isinstance(v, str) else walk(v)) for k, v in o.items()}
        if isinstance(o, list):
            return [walk(v) for v in o]
        return o
    return walk(layout)


def localize_rulecard(card: Dict[str, Any], lang: str) -> Dict[str, Any]:
    rc = catalog(lang).get("rulecards", {}).get(card.get("id"), {}) if catalog(lang) else {}
    return {**card, **{k: v for k, v in rc.items() if k in ("title", "guidance", "category")}}
