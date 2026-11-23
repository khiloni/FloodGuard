# FloodGuard Progress

Organized by component. Everything below is committed on `main`; nothing has been pushed or deployed from this
workspace. The hosted Render link keeps running the last pushed version until you push.

## Engine and scenario packs
- [x] Pure, seeded, integer-only `step(state, action, rng)`; phases before → flood → recovery.
- [x] Four packs, each with its own forecast, resources, zones, five characters, difficulty levers and one
      special mechanic:
      `village-river-01` (river flood), `urban-flash-flood-01` (blocked drains, underpass),
      `dam-release-01` (scheduled release, staggered-release request), `cyclone-surge-01` (fishing boats at sea,
      landfall cuts power).
- [x] Difficulty `easy | standard | hard` scales resources, forecast and support delay.
- [x] Outside support (`request_external_support`): one request, arrives after a delay, adds boats, trucks,
      sandbags and supplies.
- [x] Recovery covers contamination, disease, relief stock, damaged houses, power and roads (existing action
      names kept).
- [x] Tests: every pack loads, validates and is deterministic per seed; invariants run over all packs.

## API
- [x] `/api/v1` with a frozen contract in `docs/openapi.json` (API version 2.1.0).
- [x] Sessions take `scenario_id`, `seed`, `difficulty`, `language`; scenarios list carries card metadata,
      characters and shelters.
- [x] `POST /sessions/{id}/help`: 2–3 valid options with one-line trade-offs from a deterministic advisor;
      the LLM may rephrase them, with template fallback. Nothing executes until the player confirms.
- [x] NPC replies carry an optional suggestion; each character sees only its allowed facts.
- [x] Summary feeds the HUD and village status: score so far, residents at risk, warnings delivered,
      mechanic and support state, per-zone damage and drains.
- [x] Report: score breakdown, causal chain with linked rule cards (RC-01..RC-14), seed and difficulty for
      "retry with the same seed".

## LLM layer
- [x] One OpenAI-compatible client with presets chosen by env: `sarvam`, `cloudflare`, `huggingface`,
      `ollama`. Keys only in environment variables; a missing key reports `missing_key` and uses templates.
- [x] Only Apache-2.0 / MIT models; the model and its licence are shown in `/meta`.
- [x] Every output validated (numbers, tone, language, leakage), retried twice, then replaced by templates.
- [ ] Human check: run once with a real key (Sarvam, Cloudflare or Hugging Face) and confirm `source: llm`
      in narration, NPC replies and Help; then remove the key and confirm the template fallback.

## Frontend
- [x] Branding: original shield-and-drop logo, favicon, PWA icons and manifest, theme colour, meta tags.
- [x] Story list with hazard art, difficulty and language selectors.
- [x] One-screen layout (100dvh): only inner panels scroll. HUD with time left, water against warning and
      danger, residents at risk and score so far.
- [x] Two pages, Act and Village, switched by swipe, numbered tabs, arrows and dots, or the arrow keys.
- [x] Act: animated SVG map from scenario data (river/sea/canal, dam, city blocks, railway, underpass,
      shelters, resource cluster that greys out at zero), grouped orders with picker, free text, clarify,
      "What should I do?" with pending-order confirmation, timeline and replay.
- [x] Village: briefing, status board, story and event logs, chat with five characters, outside-support
      control with its arrival delay.
- [x] One animation per engine event type (45), including convoy, depleted resource, drains, dam release,
      boat recall and landfall.
- [x] Kept: disclaimer gate, persistent 112/1078 footer, real-emergency screen, report disclaimer, reduced
      motion, keyboard access, colour-blind-safe palette with text and pattern backups,
      "Stylized teaching model, not a flood forecast" label on the map.

## Deployment
- [x] Render (Docker, template mode) unchanged.
- [x] Oracle Cloud Always Free kit: `docker-compose.yml` (app + Caddy HTTPS, optional local Ollama),
      `deploy/Caddyfile`, `deploy/oracle-setup.sh`, `.env.example`, guide in `docs/DEPLOY_ORACLE.md`.
- [ ] Human step: create the VM, follow the guide, run its verification list, then switch links.

## Verification (latest run)
- Backend: `pytest` 111 passed.
- Frontend: `tsc` clean, build OK, 152 KB gzip in total including icons (budget 300 KB), no mock code or
  caniuse data in `dist/`; Playwright 29 passed (desktop and 360 px mobile, Chrome).
- Not run here: `docker build` / `docker compose up` (no Docker in this workspace) and a live LLM key.

## Optional extensions (not started)
- Rumour mechanic (false information spreading between characters).
- What-if replay (branch from a past tick with a different order).
