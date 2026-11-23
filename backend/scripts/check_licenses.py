"""License allowlist check for the installed Python environment (stdlib only).

Run in CI after `pip install -r backend/requirements.txt`:
    python backend/scripts/check_licenses.py

Allowed (project brief): MIT, Apache-2.0, BSD, ISC, public domain.
Anything else must be listed in EXCEPTIONS with a reason, and in docs/LICENSES.md.
"""
import re
import sys
from importlib import metadata

ALLOWED = [
    r"\bMIT\b",
    r"\bApache\b",
    r"\bBSD\b",
    r"\bISC\b",
    r"Public Domain",
    r"\bUnlicense\b",
    r"\bCC0\b",
    r"\b0BSD\b",
]

# Packages outside the allowlist that cannot be avoided. Keep in sync with docs/LICENSES.md.
EXCEPTIONS = {
    "typing-extensions": "PSF-2.0 (same permissive license as Python itself); required by pydantic and FastAPI.",
    "certifi": "MPL-2.0 (weak, file-level copyleft; unmodified CA certificate bundle); "
               "required by httpx. Pending project-owner approval.",
}

# Installer/tooling packages that are not part of the project.
IGNORE = {"pip", "setuptools", "wheel", "pip-licenses", "prettytable", "wcwidth", "distribute"}


def _norm(name):
    return re.sub(r"[-_.]+", "-", name).lower()


def license_strings(dist):
    meta = dist.metadata
    out = []
    for key in ("License-Expression", "License"):
        val = meta.get(key)
        if val and val.strip() and val.strip().upper() != "UNKNOWN" and len(val) < 200:
            out.append(val.strip())
    out += [c.split("::")[-1].strip() for c in (meta.get_all("Classifier") or []) if c.startswith("License ::")]
    return out


def is_allowed(texts):
    if not texts:
        return False
    # An "A OR B" expression is fine if any branch is allowed.
    for t in texts:
        for branch in re.split(r"\s+OR\s+|;", t):
            if any(re.search(p, branch, re.IGNORECASE) for p in ALLOWED):
                return True
    return False


def main():
    failures, excepted, ok = [], [], 0
    seen = set()
    for dist in metadata.distributions():
        name = _norm(dist.metadata["Name"] or "")
        if not name or name in seen or name in IGNORE:
            continue
        seen.add(name)
        texts = license_strings(dist)
        if is_allowed(texts):
            ok += 1
        elif name in EXCEPTIONS:
            excepted.append(f"  {name}: {EXCEPTIONS[name]}")
        else:
            failures.append(f"  {name} {dist.version}: {texts or ['<no license metadata>']}")

    print(f"{ok} packages on the allowlist.")
    if excepted:
        print("Documented exceptions:\n" + "\n".join(sorted(excepted)))
    if failures:
        print("NOT ALLOWED (add a replacement, or a documented exception):\n" + "\n".join(sorted(failures)))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
