# FloodGuard: backup, everything built so far, and the vision for what comes next

One file to come back to. Written 27 November 2026, updated the same day after the language, voice and Future Lens work.

> FloodGuard is an educational simulation, not emergency guidance. In a real emergency in India call
> **112** or the disaster helpline **1078** and follow your local authorities.

---

## 1. The backup

Everything built up to 27 November 2026 (before the v3 upgrade) is saved in two ways:

| What | Where | How to use it |
| --- | --- | --- |
| Git tag | `backup/2026-11-27` (points at `main`, commit `7f6142f`) | `git checkout backup/2026-11-27` |
| Full-history bundle (one file, every branch and tag) | `E:\floodguard_unleashllm\backups\floodguard-backup-2026-11-27.bundle` (about 2.2 MB) | see below |

Restore the whole repository from the bundle, anywhere, without GitHub:

```powershell
git clone E:\floodguard_unleashllm\backups\floodguard-backup-2026-11-27.bundle floodguard-restored
```

Check that the bundle is intact:

```powershell
git bundle verify E:\floodguard_unleashllm\backups\floodguard-backup-2026-11-27.bundle
```

The tag is local until pushed (`git push origin backup/2026-11-27`). Copy the bundle file to a USB drive or
cloud folder for an off-machine copy. The `backups/` folder is in `.gitignore`, so the bundle is never
committed into the repository itself.

---

## 2. What has been built (v1 to v2)

**Idea.** You lead a flood response through three phases: *before* (warnings, shelters, evacuation),
*during* (boats, trucks, sandbags, protecting vulnerable people) and *after* (search and rescue, clean
water, medical camp, roads, power, damage surveys and a safe return home).

**Rule of the architecture:** the engine decides, the API moves data, the LLM only describes.

| Layer | Where | What it does |
| --- | --- | --- |
| Engine | `backend/app/engine/` | Pure, deterministic `step(state, action, rng)`; three phases; scenario mechanics; outside support; integer scoring out of 100 |
| Scenarios | `scenarios/*.yaml` | Story packs: forecast, resources, zones, characters, difficulty levers, mechanic, map layout |
| API | `backend/app/main.py` | FastAPI `/api/v1/*`, frozen contract in `docs/openapi.json` |
| LLM (optional) | `backend/app/llm/` | Narration, character dialogue, help phrasing and a fallback parser through any OpenAI-compatible provider (Sarvam, Cloudflare, Hugging Face, Ollama). Every output is validated, retried, then replaced by templates |
| Guardrails | `backend/app/guardrail/` | Numbers and events must match the engine; no invented outcomes; language/script check; real-emergency detector |
| Frontend | `frontend/` | React + TypeScript + Vite, one-screen two-page UI, inline SVG maps, per-event animations, timeline, replay and report |
| Tests | `backend/tests`, `frontend/e2e` | Determinism, invariants, golden runs, scenario packs, guardrails; Playwright on desktop and 360 px mobile with a mock API |
| Deploy | `Dockerfile`, `docker-compose.yml`, `deploy/`, `render.yaml` | Single container; Caddy HTTPS on Oracle Cloud Always Free; Render free tier |

**Stories in v2:** Riverbank Village (river flood, embankment), Ward 14 (urban flash flood, blocked drains and
an underpass), Below Kalindi Dam (scheduled dam release you can ask to stagger), Cyclone at Machhiwada
(storm surge, fishing boats at sea, landfall cuts power).

---

## 3. What v3 adds (this upgrade)

### Two new stories
| Story | Hazard | What makes it different |
| --- | --- | --- |
| **Kamalpur Char: Island in the River** | River island flood | Two hamlets on a sandbar with no road to the mainland: every evacuation is a boat crossing; a raised flood platform on the island; a ring bund; islands visibly shrink as the river rises |
| **Glacial Lake Burst above Tsomo Valley** | Glacial lake outburst | 15-minute turns, only seven turns of warning before a sudden surge; snow peaks, a glacial lake and a suspension bridge; the surge overtops the gabion wall |

Both run on the existing engine and are covered by the pack tests (expert play scores well, doing nothing
scores 0).

### Future Lens: see both futures before you act (new, not found in other simulators)
Before an order is confirmed, the simulator plays the next few hours twice on copies of its deterministic
engine: once with your order and once if you wait. You see both side by side (people safe, still at home,
lost, embankment breaks, a small at-risk curve) and can **watch either future on the map** and scrub through
it. Because the engine has no randomness, the preview is exactly what will happen if nothing else changes.
Nothing is saved and no time passes. It is on by default and can be switched off next to the orders.
(`POST /api/v1/sessions/{id}/preview`.)

### The Village page is now one big conversation
The story log and the event log were replaced by a single chat thread: the narrator, every character (with
portraits) and you, as chat bubbles. A "To:" picker sends either an order to Command or a question to a
character; suggestions from characters can be adopted with one tap; the mic works here too. Status and the
briefing sit in a narrower side column.

### Everything in eight languages
English, हिन्दी, ગુજરાતી, मराठी, বাংলা, தமிழ், తెలుగు, ಕನ್ನಡ. One choice on the story list changes
**everything**: menus, buttons, map labels, the six stories (names, descriptions, characters and their
lines), every narration line, character reply, rejection, help option, the report and rule cards, and the
whole Flood Academy. It works with the AI off.
- Server side (`backend/app/i18n/<lang>.yaml`): each English sentence the engine produces is matched against
  a catalogue of 245 sentence patterns and rewritten in the chosen language, with numbers and 165 place and
  person names carried across. The engine and the English API are untouched.
  `backend/tests/test_i18n.py` replays every story and fails if any sentence is left untranslated or loses a
  number or name.
- Screen side (`frontend/src/i18n/<lang>.json`, loaded only when chosen): 583 interface strings.
  `npm run i18n:check` fails if a language misses one.
- Translations were drafted for this project and **should be reviewed by native speakers** before wide use.

### Voice assistant with two voices
- Two clearly different voices: a **narrator** for the story and characters, and a **command** voice that
  reads back your orders. Lines are queued, never cut off.
- **With a Sarvam AI key** (`SARVAM_API_KEY`): natural Indian-language voices (bulbul:v3, narrator `priya`,
  command `rahul`, changeable with `SARVAM_NARRATOR_SPEAKER` / `SARVAM_COMMAND_SPEAKER`), and spoken orders in
  any of the languages are turned into English for the order parser (saaras:v4, translate mode). Audio is
  passed through and not stored.
- **Without a key**: the browser's own voices. Many Windows PCs only have English voices installed; add a
  language under Windows Settings > Time & language > Speech, or use the Sarvam option.

### A more beautiful, living map
Lit terrain, soft shadows, tiled-roof houses, layered trees and pines; water with depth and moving shimmer;
cloud shadows, wind-blown rain with splashes, lightning at danger level; night with stars and glowing windows;
a rainbow and birds when recovery begins. All motion stops with *Reduce motion*.

### Flood Academy
Seven lessons, a water-depth explorer (what 15, 30, 60 and 120 cm of moving water does), a go-bag builder, a
printable family flood plan and a ten-question quiz, all translated.

### Removed on request
Medals, the ambient rain soundscape and the per-card difficulty tag (difficulty is chosen once, above the
story cards). Best score and stars per story remain.

---

## 4. The vision: what to build next

The goal: **the most trusted, most beautiful way for anyone in India, from a school child to a district
officer, to feel what a flood is like and learn what saves lives.**

### Phase A (next 1 to 2 months): reach everyone
1. **Native-speaker review of all eight languages** with disaster-management educators; add Malayalam,
   Odia, Punjabi and Assamese (Sarvam already speaks them).
2. **Voice-first mode.** A hands-free mode for low-literacy players: the narrator reads everything, the
   player answers by voice, buttons have spoken labels. Offline speech models for Indian languages
   (for example open models served from the backend) so it works without Chrome.
3. **Offline PWA.** Cache the app and the six stories so it runs in a classroom with no internet.
4. **Accessibility audit** with screen-reader users and colour-blind players; larger-text mode.

### Phase B (2 to 4 months): deeper simulation
5. **New stories**: a coastal megacity monsoon (Mumbai-style), a Brahmaputra multi-day flood with
   livestock, a Kerala landslide-plus-flood, a heatwave-then-cloudburst in a hill town, a riverine school
   evacuation story told from a teacher's point of view.
6. **Story editor.** A visual editor for teachers and NGOs to draw a map of their own village, place homes and
   shelters and publish a scenario pack, validated by the same tests.
7. **Weather and gauges as learning tools**: an interactive IMD-style colour warning panel and a CWC-style
   river gauge chart that players learn to read before acting.
8. **People with stories.** Named families who appear across turns, with needs that change (a pregnant woman,
   a fisherman, a child with asthma); the report tells what happened to each of them.

### Phase C (4 to 6 months): learning together
9. **Classroom mode.** A teacher starts a session, students join with a code and each leads one ward; the
   teacher sees a live dashboard and a debrief with cause-and-effect chains.
10. **Compare with an expert.** After a story, replay your run side by side with an expert run and see
    where the paths split.
11. **Community drills.** A printable "village drill kit" generated from a played story: roles, routes,
    shelter list and a checklist, for real community preparedness exercises led by local authorities.
12. **Research partnerships.** Work with SDMAs, NDMA-aligned trainers and universities to validate lessons
    and measure learning gains (pre- and post-quizzes, anonymised and opt-in).

### Phase D: quality and trust (always on)
- Keep the safety line everywhere: an educational simulation, never a forecast; 112 and 1078 always visible.
- Every new number in a story comes from the scenario file and is covered by tests.
- Every AI output stays validated against engine facts; template fallback always works without an LLM.
- Keep the bundle small (about 174 KB gzip of a 300 KB budget; each language pack about 21 KB, loaded only
  when chosen) so it loads on cheap phones.
- Future Lens next steps: compare three or more candidate orders at once, and a "what went wrong" mode in the
  report that shows the best alternative at each turning point.

---

## 5. How to run it

```powershell
python -m venv .venv; .venv\Scripts\activate; pip install -r backend/requirements.txt
uvicorn backend.app.main:app --port 10000 --reload
```

```powershell
cd frontend; npm install; npm run dev
```

No backend? `npm run dev:mock` replays recorded real responses. Tests: `pytest -p no:opik -p no:langsmith`
(backend) and `npx playwright test` (frontend). After changing a scenario run
`python -m backend.scripts.record_fixtures`.
