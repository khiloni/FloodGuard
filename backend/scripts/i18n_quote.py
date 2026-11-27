"""Quote catalogue values that YAML would misread (values starting with { or other indicators).

    python -m backend.scripts.i18n_quote backend/app/i18n/hi.yaml
"""
import sys


def split_key(line: str):
    """'  key: value' -> (indent, key, value); handles quoted keys that contain ': '."""
    body = line.lstrip(" ")
    indent = line[: len(line) - len(body)]
    if body[:1] in ("'", '"'):
        q = body[0]
        i = 1
        while i < len(body):
            if body[i] == q:
                if q == "'" and i + 1 < len(body) and body[i + 1] == "'":
                    i += 2
                    continue
                break
            i += 1
        key, rest = body[: i + 1], body[i + 1:]
        if not rest.startswith(": "):
            return None
        return indent, key, rest[2:]
    if ": " not in body:
        return None
    k, v = body.split(": ", 1)
    return indent, k, v


def fix(path: str) -> int:
    lines = open(path, encoding="utf-8").read().split("\n")
    changed = 0
    for n, line in enumerate(lines):
        parts = split_key(line)
        if not parts:
            continue
        indent, key, value = parts
        if value[:1] in ("{", "[", "*", "&", "!", "%", "@", "`", "|", ">") and not value.startswith("{title:"):
            lines[n] = f"{indent}{key}: '" + value.replace("'", "''") + "'"
            changed += 1
    open(path, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
    return changed


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(p, fix(p), "values quoted")
