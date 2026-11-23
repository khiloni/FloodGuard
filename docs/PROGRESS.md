# FloodGuard Progress

Base: commit `8b67f9b` (Phase 0, F1-F3, LLM layer, layout data). The earlier uncommitted frontend
attempt was kept in a stash during Part 3 and dropped on 23 Nov 2026 after the rebuild.

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

## Part 3 - Immersive visual frontend - DONE
- [x] Rebuilt from scratch (the old attempt stash has been dropped).
- [x] Scene from API layout only: river, embankment (cracks, breach), zones, houses, residents and
      vulnerable icons, routes, moving boats/trucks, shelter occupancy, recovery sites; rain and
      dusk/night toward the peak, clearing in recovery. No outcomes computed in the browser.
- [x] One animation per event type (33), intro, timeline with phases/peak/markers, replay scrubber from
      `GET /log?frames=true` (frames computed by the server), end-of-story report with causal chain.
- [x] Controls: 16 icon buttons with tooltips and parameter pickers, free text with phase example chips,
      clarify buttons, source badges, LLM badge, "AI-generated, may be wrong" label, NPC portraits.
- [x] Kept: disclaimer gate, persistent 112/1078 footer, real-emergency screen, waking-up state, aria-live,
      reduced motion, 360px mobile, keyboard access, colour-blind-safe palette with text/pattern backups.
- [x] 75 KB gzip (budget 300 KB); MSW only in `--mode mock`, verified absent from `dist/`.
- [x] Playwright: 18 tests passing (Chrome). CI job added.

## Final verification (local, this run)
- `pytest`: 72 passed. License check: pass (2 documented exceptions).
- Frontend: `tsc` clean, build OK, size check OK, Playwright 18/18 (run twice).
- Not verified here: `docker build` (no Docker in this environment) and the Render deploy.

## Cleanup and license decisions (23 Nov 2026)
- [x] MPL-2.0 allowed for unmodified dependencies (certifi via httpx, Hypothesis if added); httpx kept.
- [x] caniuse-lite (CC BY 4.0) accepted as a dev-only build-time exception with attribution; the size check
      fails the build if caniuse data ever reaches `frontend/dist` (currently 0 files).
- [x] Dead code removed (unused imports and wrapper in the backend, unused icon re-exports).
- [x] Old frontend stash dropped.
- [x] Verified: pytest 72 passed, license check pass, frontend build + size check + Playwright 18 passed.
- Ready to push: all work is committed locally on `main`; nothing pushed or deployed.

## Open questions
- None. (`FloodGuard - Complete Project Documentation.md` and `FloodGuard - Implementation Plan.md` in the
  repository root are the original planning documents and were left in place.)
