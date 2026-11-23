# FloodGuard: Educational Flood-Response Story Simulation

> [!CAUTION]
> **Educational simulation, not emergency guidance.**
> FloodGuard is a simplified teaching game. Its water levels, outcomes and scores are invented and are
> **not** a flood forecast, an evacuation plan or operational guidance. Characters are fictional and
> AI-generated text can be wrong.
> **If you are in a real flood emergency, stop and call 112 (India emergency number) or 1078 (disaster
> helpline).** Follow your local authorities, the India Meteorological Department (IMD), the Central Water
> Commission (CWC) and your State Disaster Management Authority (SDMA).

## What it is

You are the decision-maker of a riverside village as a monsoon flood arrives. The story covers
**before** the flood (warnings, shelter, evacuation), **during** it (boats, trucks, sandbags, protecting
vulnerable people) and **after** it (search and rescue, clean water, medical camp, roads, power, damage
surveys and a safe return home). You watch it all happen on an animated top-down village map.

**The engine decides what happens. The API moves data. The LLM only describes.**

| Layer | Where | What it does |
| --- | --- | --- |
| Engine | `backend/app/engine/` | Pure, deterministic `step(state, action, rng) -> (state, events)`; 16 actions; 3 phases; integer scoring out of 100 |
| Scenario | `scenarios/village-river-01.yaml` (v2.0.0) | 30 ticks of 30 min, forecast curve, resources, recovery constants, map layout |
| API | `backend/app/main.py` | FastAPI `/api/v1/*`, frozen contract in `docs/openapi.json` |
| LLM (optional) | `backend/app/llm/openai_compat.py` | Narration, NPC dialogue and a fallback parser via any OpenAI-compatible server (Ollama, llama.cpp, vLLM); every output is validated, retried twice, then replaced by templates |
| Frontend | `frontend/` | React + TypeScript + Vite; inline SVG village scene, per-event animations, timeline and replay |

Docs: [ARCHITECTURE](docs/ARCHITECTURE.md) · [POST_FLOOD_DESIGN](docs/POST_FLOOD_DESIGN.md) ·
[MODEL_CARD](docs/MODEL_CARD.md) · [LICENSES](docs/LICENSES.md) · [PROGRESS](docs/PROGRESS.md)

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
Useful URL switches in mock mode: `?mock=allEvents` (every animation at once), `?mock=end` (jump to the last turn), `?mock=slow` (cold start), `?mock=llm` (AI badges).

## Run with an open-source LLM (Ollama)

1. Install Ollama (MIT) and read the model card of an Apache-2.0 model, for example
   [Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct).
2. Pull it and start the backend in LLM mode:
   ```powershell
   ollama pull qwen2.5:1.5b
   # Windows PowerShell
   $env:LLM_MODE="openai_compat"; $env:LLM_BASE_URL="http://127.0.0.1:11434/v1"; $env:LLM_MODEL="qwen2.5:1.5b"
   uvicorn backend.app.main:app --port 10000
   ```
   ```bash
   # macOS / Linux
   LLM_MODE=openai_compat LLM_BASE_URL=http://127.0.0.1:11434/v1 LLM_MODEL=qwen2.5:1.5b uvicorn backend.app.main:app --port 10000
   ```
3. `GET /api/v1/health` shows `llm_mode: openai_compat`. Messages show `source: llm` (an "AI · may be wrong"
   badge in the UI). Stop Ollama and the next turn falls back to `source: template`; the game never blocks.

Optional settings: `LLM_TIMEOUT` (30 s), `LLM_CONNECT_TIMEOUT` (3 s), `LLM_TURN_BUDGET` (45 s),
`LLM_COOLDOWN` (15 s), `LLM_MAX_TOKENS` (300), `LLM_JSON_MODE` (1).

## Tests

```bash
pytest -v -p no:opik -p no:langsmith          # 72 backend tests
python backend/scripts/check_licenses.py      # dependency license allowlist
cd frontend
npm run build && npm run size                 # type-check, build, 300 KB gzip budget, no mocks in dist
npx playwright install chromium               # once
npx playwright test                           # 18 end-to-end tests (mock API, desktop + 360px mobile)
```
After changing the API or scenario: `python -m backend.scripts.export_openapi` (contract) and
`python -m backend.scripts.record_fixtures` (frontend mock fixtures).

## Docker

```bash
docker build -t floodguard:latest .
docker run --rm -p 10000:10000 floodguard:latest      # http://localhost:10000
```
The image builds the frontend and serves it from FastAPI on port 10000 with `LLM_MODE=template`.

## Deploy to Render (free tier)

`render.yaml` defines a Docker web service on port 10000 with health check `/api/v1/health` and
`LLM_MODE=template`. Connect the GitHub repository as a Blueprint (or redeploy the existing service) after
pushing `main`. The free tier sleeps when idle; the UI shows a "waking up" screen during the cold start.

## License

Apache-2.0 for code; CC BY 4.0 for rule cards and scenario content. Every dependency is listed in
[docs/LICENSES.md](docs/LICENSES.md).
