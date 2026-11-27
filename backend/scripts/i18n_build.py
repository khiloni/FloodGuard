"""Build backend/app/i18n/<lang>.yaml from an ordered translation source.

    python -m backend.scripts.i18n_build <lang> <source.json>
    python -m backend.scripts.i18n_build --keys        # print the English keys in order

The source JSON holds lists in the same order as the English keys (taken from hi.yaml, the
reference catalogue), so English keys are never retyped:
    {"names": [...], "sentences": [...], "scenarios": {...}, "rulecards": {...}}
"""
import json
import os
import sys

import yaml

HERE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "i18n")


def reference():
    with open(os.path.join(HERE, "hi.yaml"), encoding="utf-8") as f:
        return yaml.safe_load(f)


def build(lang: str, src_path: str) -> None:
    ref = reference()
    with open(src_path, encoding="utf-8") as f:
        src = json.load(f)
    out = {}
    for section in ("names", "sentences"):
        keys = list(ref[section].keys())
        vals = src[section]
        if isinstance(vals, dict):  # names may be given as {English: translation}
            missing = [k for k in keys if k not in vals]
            if missing:
                raise SystemExit(f"{section}: missing {missing[:10]}")
            vals = [vals[k] for k in keys]
        if len(keys) != len(vals):
            raise SystemExit(f"{section}: {len(keys)} English keys but {len(vals)} translations")
        out[section] = dict(zip(keys, vals))
        if section == "sentences":
            import re
            ph = re.compile(r"\{[npq]\d+\}")
            bad = [(i, k) for i, (k, v) in enumerate(out[section].items()) if sorted(ph.findall(k)) != sorted(ph.findall(v))]
            if bad:
                raise SystemExit(f"placeholder mismatch (likely misaligned) at {bad[:5]}")
    out["scenarios"] = src["scenarios"]
    out["rulecards"] = src["rulecards"]
    header = f"# {lang}: built by backend/scripts/i18n_build.py. Drafted for FloodGuard; native-speaker review welcome.\n"
    with open(os.path.join(HERE, f"{lang}.yaml"), "w", encoding="utf-8", newline="\n") as f:
        f.write(header)
        yaml.safe_dump(out, f, allow_unicode=True, sort_keys=False, width=1000)
    print(f"{lang}: {len(out['names'])} names, {len(out['sentences'])} sentences, {len(out['scenarios'])} stories")


if __name__ == "__main__":
    if sys.argv[1] == "--keys":
        ref = reference()
        for section in ("names", "sentences"):
            for i, k in enumerate(ref[section]):
                print(f"{section[0]}{i}\t{k}")
    else:
        build(sys.argv[1], sys.argv[2])
