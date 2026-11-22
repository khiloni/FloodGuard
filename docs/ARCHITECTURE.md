# FloodGuard Architecture & Design Specification

## The Core Architectural Principle
> **The engine decides outcomes. The API moves data. The LLM only describes.**

FloodGuard strictly enforces clear layer boundaries to ensure educational safety, numerical determinism, and mathematical integrity.

```
frontend/ (React + TypeScript + Animated SVG Village Map)
    │  HTTP /api/v1 (JSON, frozen OpenAPI 3.1 contract: docs/openapi.json)
    ▼
backend/app/main.py (routing, CORS, rate limiting, input length caps)
    ▼
backend/app/services/turn_pipeline.py (turn orchestration pipeline)
    │        ├── guardrail/emergency.py (112 & 1078 real-emergency detection)
    │        ├── services/parser.py (rule-based NLP parser with typo & Hindi support)
    │        ├── llm/openai_compat.py (optional open-source LLM layer: Ollama/vLLM)
    │        ├── rag/bm25.py (in-memory BM25 over verified educational rule cards)
    │        └── guardrail/validator.py (tone, allowed numbers, outcome claims)
    ▼
backend/app/engine/ (Pure, Deterministic, Integer-only Simulation State Machine)
    │   step(state: State, action: Action, rng: Random) -> (State, List[Event])
    ▲
scenarios/village-river-01.yaml (declarative topography, canvas layout, hydrology curve)
    ▼
backend/app/store/sqlite.py (SQLite audit log & bit-exact session replay)
```

---

## The Three Pillars

### 1. The Pure Engine (`backend/app/engine/`)
- **Purity**: Zero I/O, zero network, zero database, zero LLM dependencies.
- **Determinism**: Given an initial `State`, an `Action`, and a seeded `Random`, `step(state, action, rng)` returns the exact same `(new_state, events)` on any hardware or operating system.
- **Integer Arithmetic**: Water levels, elevations, population numbers, sandbags, and scores use integer arithmetic to prevent floating-point drift across platforms.
- **Immutable Data Structures**: All states (`State`, `ZoneState`, `ShelterState`, `ResourceState`, `EmbankmentState`) and `Event` models are frozen Pydantic models.

### 2. The API & Data Store (`backend/app/main.py`, `backend/app/store/`)
- **Contract Enforcement**: `docs/openapi.json` is the frozen single source of truth for all communication between backend and frontend.
- **Audit Logging**: Every turn's action and resulting events are persisted in SQLite (`turn_events`).
- **Bit-Exact Replay**: Replaying recorded actions from a session log with the original scenario seed produces an identical final state.
- **Hardening**:
  - `MAX_INPUT_CHARS` (default 400) limits free-text input.
  - `RATE_LIMIT_PER_MIN` (default 30) prevents flooding.
  - Strict CORS policy configurable via `ALLOWED_ORIGINS`.

### 3. The LLM Layer (`backend/app/llm/openai_compat.py`)
- **Off by Default**: Default `LLM_MODE=template`. When `LLM_MODE=openai_compat`, connects to any OpenAI-compatible server (Ollama, llama.cpp, vLLM).
- **Strict Information Isolation**: The LLM **never** sees full state, hidden variables, or engine code. It receives only:
  1. `persona`: NPC role or narrator persona
  2. `facts_allowed`: Explicit set of approved integers (current water level, remaining population, etc.)
  3. `events_this_turn`: List of events produced by the engine this tick
  4. `rule_cards`: Relevant educational rule cards retrieved via BM25
  5. `language`: Target language code (default "en")
  6. `constraints`: Guardrail rules
- **Delimited Player Data**: Player text is enclosed in `<<<PLAYER_INPUT>>> ... <<<END_INPUT>>>` and marked strictly as untrusted data to prevent prompt injection.
- **Dual Responsibilities**:
  - **Job 1 (Voice & Narration)**: Turn narration and NPC dialogue -> JSON `{text, cited_cards}`.
  - **Job 2 (Fallback Parser)**: Used only when the rule-based parser cannot resolve player intent. Temperature 0. Validated against the `ActionName` enum, schema, and engine preconditions. Anything invalid becomes `status: clarify` and simulation time does not advance.
- **Resilient Fallback**: All LLM outputs pass through `GuardrailValidator`. On validation failure, retries up to 2 times with feedback. If it still fails, times out, or the endpoint is unreachable, it silently falls back to deterministic templates. The simulation never crashes or stalls.

---

## Guardrails & Educational Safety

1. **Real-Emergency Detector (`backend/app/guardrail/emergency.py`)**:
   - Detects phrases indicating real-world distress (e.g., "I am actually trapped", "real flood call 112").
   - Immediately halts simulation and displays the official India emergency contacts: **112 (National Emergency)** and **1078 (Disaster Management)**.
2. **Output Guardrail Validator (`backend/app/guardrail/validator.py`)**:
   - **Tone check**: Prohibits sensational or graphic vocabulary (defined in `tone.yaml`).
   - **Number grounding**: Verifies that every integer cited by the LLM is present in `facts_allowed`.
   - **Outcome verification**: Blocks ungrounded claims of casualties or rescues without corresponding engine events.
   - **Safety advice validation**: Blocks safety directives unless citing verified rule cards.
3. **Transparency**:
   - Every narration and NPC message carries `source: "llm" | "template"`.
   - Turn responses include `guardrail: {"status": "passed"|"fallback", "retries": n}`.
   - Frontend displays clear AI disclosure badges on all generated text.
