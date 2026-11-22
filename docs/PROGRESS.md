# FloodGuard Development Progress

## Phase A - Backend
- [x] Task 1: Visual Layout Data & Event Contract
  - Add `layout` block to `scenarios/village-river-01.yaml` (1000x600 canvas: river path, embankment segments, zone positions, school shelter, transport routes, decor, warning/danger levels).
  - Expose layout in `GET /scenarios` and `GET /sessions/{id}/state`.
  - Expose per-zone status, shelter occupancy/capacity, embankment integrity, water levels, transport available vs in use.
  - Ensure every event in turn responses and `/log` carries `type`, `tick`, `zone`/`target`, `caused_by`.
  - Add `example_commands` to `GET /meta`.
- [x] Task 2: LLM Layer (`backend/app/llm/openai_compat.py`)
  - OpenAI-compatible client supporting Ollama, llama.cpp, vLLM.
  - Job 1: NPC dialogue & turn narration -> JSON `{text, cited_cards}`.
  - Job 2: Fallback action parser with schema & state precondition validation.
  - Guardrail validator with retry (up to 2x) and silent template fallback.
  - Add `source: llm|template` to narration and NPC messages, `guardrail: {status, retries}` to turn responses, `llm_mode` to `/health` and `/meta`.
- [x] Task 3: Comprehensive Test Suite
  - Fake LLM server tests (invented numbers, "everyone survived", injected instructions, malformed JSON, markdown/URLs, wrong language, timeout, endpoint down).
  - 100+ labelled parser test phrases (typos, ties, code-mixed Hindi-English), >=90% correct, ambiguous -> clarify with time unchanged.
  - 40+ red-team inputs & 20+ bad model outputs (100% blocked).
  - 100-run determinism check, invariant checks, API contract tests.
- [x] Task 4: Hardening & Release Hygiene
  - Rate limiting (RATE_LIMIT_PER_MIN=30), input length cap (MAX_INPUT_CHARS=400), CORS from env.
  - Regenerate and freeze `docs/openapi.json`.
  - License allowlist check (`pip-licenses`, GitHub Actions CI workflow).
  - Updated `docs/LICENSES.md`, `docs/ARCHITECTURE.md`, `docs/MODEL_CARD.md`, and `README.md`.
  - Local commit on `main` preserving tag `backend-v2` at `2c024cc`.

## Gate A Status
- **Automated Backend & Contract Verification**: `pytest -v -p no:opik -p no:langsmith` passed (32 tests: determinism, invariants, golden/metamorphic, replay, 110 parser phrases, 40 red-team inputs, 25+ adversarial outputs, hardened guardrail checks for number formats/survival/markdown/URLs/delimiter sanitization/wrong-language Latin, `1078`/`112` emergency halts across `/turns` and `/npc/{id}/messages`, null-input handling, `httpx.MockTransport` fake-HTTP & circuit-breaker checks, frozen `docs/openapi.json` contract).
- **Live Ollama Daemon Check**: Verified with `qwen2.5:1.5b` (`Apache-2.0`) on `http://127.0.0.1:11434/v1` — `/api/v1/health` returned `llm_status: "online"`, live turn & NPC consultation returned `source: "llm"` (`guardrail.status: "passed"`), and unreachable-endpoint fallback returned `source: "template"` (`guardrail.status: "fallback"`, `fallback_reason: "endpoint_unavailable:ConnectError"`).

## Phase B - Frontend (Awaiting Gate A)
- Not started.

## Phase C - Integration (Awaiting Gate B)
- Not started.

## Open Questions
- None.
