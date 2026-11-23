"""Regenerate the frozen API contract: python -m backend.scripts.export_openapi"""
import json
import os

from backend.app.main import app

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "docs", "openapi.json")

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(app.openapi(), f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {OUT}")
