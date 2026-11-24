# FloodGuard: Educational Flood-Response Story Simulation

> [!CAUTION]
> **Educational simulation, not emergency guidance.**
> FloodGuard is a simplified teaching simulation. Its water levels, outcomes and scores are invented and are
> **not** a flood forecast, an evacuation plan or operational guidance. Characters are fictional and
> AI-generated text can be wrong.
> **If you are in a real flood emergency, stop and call 112 (India emergency number) or 1078 (disaster
> helpline).** Follow your local authorities, the India Meteorological Department (IMD), the Central Water
> Commission (CWC) and your State Disaster Management Authority (SDMA).

## What it is

You lead the response to a flood, from the hours **before** it (warnings, shelters, evacuation), through
**the flood itself** (boats, trucks, sandbags, protecting vulnerable people) to **recovery** (search and rescue,
clean water, medical camp, roads, power, damage surveys and a safe return home). Four stories each have their
own map, characters and one special mechanic:

| Story | Hazard | Special mechanic |
| --- | --- | --- |
| Riverbank Village Flood Response | River flood | Embankment and the river peak |
| Ward 14 Flash Flood | Urban flash flood | Blocked drains, an underpass that floods first, 15-minute turns |
| Below Kalindi Dam | Dam release | A scheduled release you can ask to stagger |
| Cyclone at Machhiwada | Cyclone storm surge | Fishing boats at sea, landfall cuts power |

Each story has easy, standard and hard difficulty. The app fits one screen: page 1 (**Act**) is the live
animated map and your orders, page 2 (**Village**) is status, the event log and the people you can talk to.
"What should I do?" lists two or three options with their trade-offs; nothing happens until you confirm.

**The engine decides what happens. The API moves data. The LLM only describes.**

| Layer | Where | What it does |
| --- | --- | --- |
| Engine | `backend/app/engine/` | Pure, deterministic `step(state, action, rng) -> (state, events)`; 3 phases; scenario mechanics; outside support; integer scoring out of 100 |
| Scenarios | `scenarios/*.yaml` | Four packs: forecast, resources, zones, characters, difficulty levers, mechanic, map layout |
| API | `backend/app/main.py` | FastAPI `/api/v1/*`, frozen contract in `docs/openapi.json` |
| LLM (optional) | `backend/app/llm/` | Narration, NPC dialogue, Help phrasing and a fallback parser through an OpenAI-compatible API (Sarvam, Cloudflare Workers AI, Hugging Face or a local Ollama); every output is validated, retried twice, then replaced by templates |
| Frontend | `frontend/` | React + TypeScript + Vite; one-screen two-page UI, inline SVG maps, per-event animations, timeline, replay and report |

Docs: [ARCHITECTURE](docs/ARCHITECTURE.md) · [POST_FLOOD_DESIGN](docs/POST_FLOOD_DESIGN.md) ·
[MODEL_CARD](docs/MODEL_CARD.md) · [LICENSES](docs/LICENSES.md) · [PROGRESS](docs/PROGRESS.md) ·
[DEPLOY_ORACLE](docs/DEPLOY_ORACLE.md)

## Run locally

Prerequisites: Python 3.11+, Node.js 20+.

**Backend** (from the repository root, template narration, no LLM needed):
```bash
python -m venv .venv            # Windows: .venv\Scripts\activate   macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --port 10000 --reload
```
API docs: http://localhost:10000/docs

**Frontend** (second terminal; proxies `/api` to port 10000):
```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

**Frontend without a backend** (mock API that replays recorded real responses):
```bash
cd frontend
npm run dev:mock
```
Useful URL switches in mock mode: `?mock=allEvents` (every animation at once), `?mock=end` (jump to the last turn), `?mock=slow` (cold start), `?mock=llm` (AI badges), `?mock=llmdown` (AI configured but offline).

## Run with an open-source LLM

The simulator is fully usable without an LLM (`LLM_MODE=template`, the default). To add AI narration, set
`LLM_MODE=openai_compat` and choose a provider with `LLM_PROVIDER`. Keys are read from environment variables
only. Only Apache-2.0 or MIT models are used.

| `LLM_PROVIDER` | Key variables | Default model (licence) |
| --- | --- | --- |
| `sarvam` | `SARVAM_API_KEY` | `sarvam-105b` (Apache-2.0) |
| `cloudflare` | `CF_ACCOUNT_ID`, `CF_API_TOKEN` | `@cf/openai/gpt-oss-20b` (Apache-2.0) |
| `huggingface` | `HF_TOKEN` | `openai/gpt-oss-20b` (Apache-2.0) |
| `ollama` (local) | none | `qwen2.5:1.5b` (Apache-2.0) |

```powershell
# Windows PowerShell, e.g. Sarvam
$env:LLM_MODE="openai_compat"; $env:LLM_PROVIDER="sarvam"; $env:SARVAM_API_KEY="<your key>"
uvicorn backend.app.main:app --port 10000
```
```bash
# macOS / Linux, local Ollama
ollama pull qwen2.5:1.5b
LLM_MODE=openai_compat LLM_PROVIDER=ollama uvicorn backend.app.main:app --port 10000
```
`GET /api/v1/meta` shows the provider, model and licence. Messages show `source: llm` (an "AI · may be wrong"
badge in the UI). If the provider is down or the key is missing, the next turn falls back to templates; the
the simulation never blocks. `LLM_BASE_URL` and `LLM_MODEL` override a preset; other optional settings: `LLM_TIMEOUT`,
`LLM_CONNECT_TIMEOUT`, `LLM_TURN_BUDGET`, `LLM_COOLDOWN`, `LLM_MAX_TOKENS`, `LLM_JSON_MODE`.

## Tests

```bash
pytest -v -p no:opik -p no:langsmith          # 111 backend tests
python backend/scripts/check_licenses.py      # dependency license allowlist
cd frontend
npm run build && npm run size                 # type-check, build, 300 KB gzip budget, no mocks in dist
npx playwright install chromium               # once
npx playwright test                           # 29 end-to-end tests (mock API, desktop + 360px mobile)
```
After changing the API or scenario: `python -m backend.scripts.export_openapi` (contract) and
`python -m backend.scripts.record_fixtures` (frontend mock fixtures).

## Docker

```bash
docker build -t floodguard:latest .
docker run --rm -p 10000:10000 floodguard:latest      # http://localhost:10000
```
The image builds the frontend and serves it from FastAPI on port 10000 with `LLM_MODE=template`.

**With Docker Compose and HTTPS** (any server; made for Oracle Cloud Always Free):
```bash
cp .env.example .env        # set SITE_ADDRESS and, optionally, an LLM provider key
docker compose up -d --build
```
Caddy serves one HTTPS URL with an automatic certificate. Step-by-step guide: [docs/DEPLOY_ORACLE.md](docs/DEPLOY_ORACLE.md).

## Deploy to Render (free tier)

`render.yaml` defines a Docker web service on port 10000 with health check `/api/v1/health` and
`LLM_MODE=template`. Connect the GitHub repository as a Blueprint (or redeploy the existing service) after
pushing `main`. The free tier sleeps when idle; the UI shows a "waking up" screen during the cold start.

## Deploy to Hugging Face Spaces (needs a PRO subscription)

Hugging Face now returns `402 Payment Required` when creating a Docker or Gradio Space on the free
`cpu-basic` hardware without a PRO subscription; only static Spaces are free, and FloodGuard needs its
Python backend. With PRO, the same `Dockerfile` runs as a Docker Space; [deploy/hf-space/README.md](deploy/hf-space/README.md) is the
Space's README (`sdk: docker`, `app_port: 10000`). Log in once with a write token, then upload:

```bash
hf auth login
python deploy/push_to_hf_space.py <hf-username>/floodguard
```

The script uploads every git-tracked file (via the Hub API, so binary icons are accepted) and sets
`LLM_MODE=openai_compat` and `LLM_PROVIDER=cloudflare`. Add `CF_ACCOUNT_ID` and `CF_API_TOKEN` yourself as
secrets under the Space's **Settings → Variables and secrets**. The app is served at
`https://<hf-username>-floodguard.hf.space`; sessions are cleared when the Space restarts.

## License

Apache-2.0 for code; CC BY 4.0 for rule cards and scenario content. Every dependency is listed in
[docs/LICENSES.md](docs/LICENSES.md).
