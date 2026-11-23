"""Regenerate the frozen API contract: python -m backend.scripts.export_openapi"""
import json
import os
import tempfile

# Schema export needs no real database (and must not lock the dev DB).
os.environ.setdefault("FLOODGUARD_DB_PATH", os.path.join(tempfile.mkdtemp(), "export.db"))

from backend.app.main import app

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "docs", "openapi.json")

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(app.openapi(), f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {OUT}")
