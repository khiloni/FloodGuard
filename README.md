# FloodGuard: Educational Flood-Response Simulation Game

> [!CAUTION]
> **CRITICAL EDUCATIONAL SIMULATION NOTICE**  
> FloodGuard is a simplified educational teaching game. Its water levels, outcomes, and resilience scores are fictional and do NOT constitute a flood forecast, evacuation plan, or operational guidance. Characters are simulated and AI-generated dialogue may contain errors.  
> **If you are in a real flood emergency or danger is present near you, immediately exit this simulation and call 112 (National Emergency Helpline) or 1078 (Disaster Management Helpline).** Always follow official instructions broadcast by local civil defence, the India Meteorological Department (IMD), the Central Water Commission (CWC), and your State Disaster Management Authority (SDMA). Do not rely on this software for real-life safety, health, or evacuation decisions.

---

## Overview

FloodGuard is an educational simulation where players coordinate disaster response for a riverside village as monsoon waters surge. Players issue alerts, order evacuations, reinforce river embankments with sandbags, open cyclone/flood shelters, and deploy rescue boats and transport trucks.

### Core Architectural Principle
> **The engine decides what happens. The API moves data. The LLM only describes.**

- **Deterministic Engine (`backend/app/engine/`)**: Pure Python state machine with integer-only arithmetic and seeded RNG. Given identical seeds and actions, replays match live runs bit-for-bit.
- **REST API (`backend/app/main.py`)**: FastAPI serving the frozen API contract (`docs/openapi.json`).
- **Open-Source LLM Layer (`backend/app/llm/`)**: OpenAI-compatible adapter supporting Ollama, llama.cpp, and vLLM. The LLM **never** decides simulation outcomes and sees only factual allowances (`facts_allowed`). On slow response, failure, or guardrail violation, it silently falls back to deterministic templates without stalling.
- **Animated Village Map (`frontend/`)**: Top-down SVG village layout with rising water levels, dynamic embankment integrity, boat animations, and evacuation routes.

---

## Quickstart: Running Locally

### Prerequisites
- Python 3.11+
- Node.js 20+ and npm

### 1. Run Backend in Template Mode (Default, No LLM Needed)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 10000 --reload
```
API documentation is available at `http://localhost:10000/docs`.

### 2. Run with Local Open-Source LLM (Ollama)
1. Install [Ollama](https://ollama.com/) (Open Source, MIT).
2. Pull an Apache-2.0 licensed model (e.g., Llama 3.2 3B or Phi-3):
   ```bash
   ollama pull llama3.2:3b
   ```
3. Run the backend pointing to Ollama:
   ```bash
   # Windows PowerShell
   $env:LLM_MODE="openai_compat"
   $env:LLM_BASE_URL="http://localhost:11434/v1"
   $env:LLM_MODEL="llama3.2:3b"
   uvicorn app.main:app --port 10000 --reload

   # Linux / macOS
   LLM_MODE=openai_compat LLM_BASE_URL=http://localhost:11434/v1 LLM_MODEL=llama3.2:3b uvicorn app.main:app --port 10000 --reload
   ```

### 3. Run Frontend Development Server
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Running with Docker

Build and run the self-contained container serving both backend and frontend:
```bash
docker build -t floodguard:latest .
docker run --rm -p 10000:10000 floodguard:latest
```
Access the application at `http://localhost:10000`.

---

## Deploying to Render (Free Tier)

FloodGuard includes a zero-config `render.yaml` blueprint:
1. Push your repository to GitHub.
2. Link the repository in the Render Dashboard as a **Blueprint**.
3. Render automatically provisions a Docker Web Service on port `10000`:
   - Runtime: `Docker`
   - Plan: `Free`
   - Health check: `/api/v1/health`
   - Default environment: `LLM_MODE=template`, `MAX_INPUT_CHARS=400`, `RATE_LIMIT_PER_MIN=30`

---

## Running the Automated Test Suite

Run all determinism, golden scenario, invariant, fake LLM, parser, and red-team tests:
```bash
pytest -v -p no:opik -p no:langsmith
```

---

## Open-Source License

This project is licensed under the **Apache License 2.0**.  
See [docs/LICENSES.md](docs/LICENSES.md) for full third-party dependency audits.
