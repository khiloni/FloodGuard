"""Deploy FloodGuard to a Hugging Face Docker Space.

Uploads every git-tracked file, with deploy/hf-space/README.md as the Space's README (it carries the
`sdk: docker` / `app_port` header), and sets the non-secret LLM variables. API keys are never handled here:
add CF_ACCOUNT_ID and CF_API_TOKEN yourself under the Space's Settings -> Variables and secrets.

Usage (log in once first with `hf auth login` or `huggingface-cli login`, using a token with write access):

    python deploy/push_to_hf_space.py <hf-username>/<space-name>
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parent.parent
SPACE_README = ROOT / "deploy" / "hf-space" / "README.md"
VARIABLES = {
    "LLM_MODE": "openai_compat",
    "LLM_PROVIDER": "cloudflare",
    "MAX_INPUT_CHARS": "400",
    "RATE_LIMIT_PER_MIN": "30",
}


def tracked_files() -> list[str]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True).stdout
    return [p for p in out.decode("utf-8").split("\0") if p]


def main() -> int:
    if len(sys.argv) != 2 or "/" not in sys.argv[1]:
        print(__doc__)
        return 2
    repo_id = sys.argv[1]
    api = HfApi()
    print(f"Logged in as {api.whoami()['name']}")

    api.create_repo(repo_id, repo_type="space", space_sdk="docker", exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        stage = Path(tmp)
        for rel in tracked_files():
            src = ROOT / rel
            if not src.is_file():
                continue
            dst = stage / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        shutil.copy2(SPACE_README, stage / "README.md")
        print(f"Uploading to spaces/{repo_id} ...")
        api.upload_folder(
            repo_id=repo_id,
            repo_type="space",
            folder_path=str(stage),
            commit_message="Deploy FloodGuard",
        )

    for key, value in VARIABLES.items():
        api.add_space_variable(repo_id, key, value)

    user, name = repo_id.split("/", 1)
    print("\nDone. The Space is now building (about 5-10 minutes).")
    print(f"  Page:     https://huggingface.co/spaces/{repo_id}")
    print(f"  App URL:  https://{user}-{name}.hf.space".lower().replace("_", "-"))
    print("Add the secrets CF_ACCOUNT_ID and CF_API_TOKEN in the Space settings if you have not yet.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
