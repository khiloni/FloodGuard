# FloodGuard Progress

Base: commit `8b67f9b` (Phase 0, F1-F3, LLM layer, layout data). An earlier
uncommitted frontend attempt is saved in `git stash` as `old-frontend-attempt`
(reference only; Part 3 rebuilds the frontend from scratch).

## Part 1 - LLM layer (backend) - DONE, awaiting human gate
- [x] `backend/app/llm/openai_compat.py`: OpenAI-compatible client (Ollama, llama.cpp, vLLM).
      Env: `LLM_MODE` (template|openai_compat, default template), `LLM_BASE_URL`, `LLM_MODEL`,
      `LLM_TIMEOUT`, `LLM_CONNECT_TIMEOUT`, `LLM_TURN_BUDGET`, `LLM_COOLDOWN`, `LLM_MAX_TOKENS`, `LLM_JSON_MODE`.
- [x] Job 1: narration and NPC dialogue -> JSON `{text, cited_cards}`; prompt gets persona,
      facts_allowed, events, rule cards, language, constraints; player text delimited as data.
      (Gap fixed: NPC prompts now also receive the retrieved rule cards.)
- [x] Job 2: fallback parser only when the rule parser returns clarify; temperature 0;
      validated against action enum, params and engine preconditions, else clarify (time does not advance).
- [x] Validator on every output; 2 retries with the violation as feedback; then template.
      Endpoint down / slow / HTTP error -> silent template fallback; circuit breaker after connect failure.
- [x] `source: llm|template` on narration and every NPC message; `guardrail: {status, retries, fallback_reason}`
      on turn responses; `llm_mode` on `/health` and `/meta`; `docs/openapi.json` frozen.
- [x] Tests: `test_llm_layer.py` (MockTransport + adversarial validator) and
      `test_fake_llm_server.py` (real local HTTP server, 16 end-to-end cases). Total 49 passing.
      (Gap fixed: real fake-server tests added; OpenAPI contract test made pydantic-version independent.)
- [x] Docs: `MODEL_CARD.md` (with human-gate checklist), `ARCHITECTURE.md`, `LICENSES.md`.
- [x] CI: stdlib license check `backend/scripts/check_licenses.py` + pytest.
      (Gap fixed: old pip-licenses step failed on SPDX names and silently allowed MPL-2.0.)
- [x] Layout block (1000x600 canvas, river, embankment, zones, shelter, routes) in
      `scenarios/village-river-01.yaml`, exposed via `/scenarios` and session state.
- [ ] HUMAN GATE: Ollama + Apache-2.0 model -> `source: llm`; stop Ollama -> fallback.

## Part 2 - Post-flood phase - DONE
- [x] `docs/POST_FLOOD_DESIGN.md` (owner asked to run all parts without the approval stop).
- [x] Engine: `phase` before -> flood -> recovery; 8 recovery actions with phase gating; recovery state
      (supplies, disease risk, illness, power/health centre, roads, surveys, returns, trust); 16 typed events,
      every event tagged `details.phase`; new arithmetic integer-only; `scenario_version` 2.0.0, 30 ticks.
- [x] Scoring rebalanced to 100: flood 75 (30/20/10/7/8) + recovery 25 (8/6/6/5).
- [x] Parser, LLM fallback parser, narration, NPC templates, rule cards RC-06..RC-10, validator.
- [x] API: summary has `phase`, `recovery`, per-zone recovery fields; report has `phases` + `causal_chain`;
      `layout.recovery_sites`; `docs/openapi.json` regenerated (API version 2.0.0).
- [x] Tests: 71 passing (invariants over 3 phases, golden playbooks, metamorphic, determinism, API replay).
- Note: sessions saved in an old SQLite file with scenario 1.0.0 replay with the 2.0.0 rules.

## Part 3 - Immersive visual frontend - NOT STARTED

## Open questions
- certifi (MPL-2.0, pulled in by httpx) is listed as a documented exception pending approval.
