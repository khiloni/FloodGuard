# FloodGuard: backup, everything built so far, and the vision for what comes next

One file to come back to. Written 27 November 2026.

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

Both run on the existing engine (no new mechanic code), pass the pack tests, and reward good play (expert
runs score 61 and 67; doing nothing scores 0).

### A far more beautiful, living map
- Lit terrain with texture, soft shadows, new houses with tiled roofs and windows, layered trees and pines.
- Water with depth gradients, a moving shimmer, foam along the bank; flooded wards show murky water.
- Weather that follows the story: drifting cloud shadows, wind-blown rain with splashes (heavier near the
  peak, slanted for the cyclone), lightning when the water is in danger, a pulsing danger glow round the map.
- Light that follows time: dusk, night with stars, warm glowing windows where people are still home, lamps in
  an open shelter; a rainbow and birds when recovery begins.
- Every new animation stops when *Reduce motion* is on or the OS asks for reduced motion.

### Flood Academy (learn first, then lead)
- **Seven lessons**: river floods, urban flash floods, dam releases, cyclones and storm surge, river
  islands, glacial lake outbursts, and what to do after the water goes down.
- **How deep is too deep?** Slide the water up beside an adult, a child and a car and see what 15, 30, 60
  and 120 cm of moving water mean.
- **Go-bag builder**: pack an emergency bag; get told what is missing and what would slow you down.
- **Family flood plan**: eight-step checklist, saved on the device, printable.
- **Quiz**: ten questions with explanations.

### Medals, stars and progress
Best score and 1 to 3 stars per story on the story cards; twelve medals (for example *No One Left Behind*,
*Clean Water Hero*, *Every Shore*, *Academy Graduate*). Kept only in this browser.

### Indian languages and a voice assistant
- **Eight languages** for menus, AI narration and voice: English, हिन्दी, ગુજરાતી, मराठी, বাংলা, தமிழ்,
  తెలుగు, ಕನ್ನಡ. One choice on the story list sets all three. The AI is told the language by name and its
  output must be in that language's script, or it is rejected and the template is used. Story text and the
  fixed template narration stay in English for now.
- **Read aloud**: the narrator speaks each new line (English text in an Indian-English voice, translated AI
  text in the chosen language's voice, where the device has one).
- **Speak an order**: tap the microphone and say an order such as "evacuate ward 1". Uses the browser's own
  speech recognition (Chrome and Edge). Offline, the order parser understands English best; with the AI on,
  orders in other languages are interpreted by the AI parser.

### Ambient soundscape
Rain, wind and thunder generated live in the browser (no audio files) that follow the phase and water level;
birds in recovery; soft cues for good and bad events. Off until you turn it on.

---

## 4. The vision: what to build next

The goal: **the most trusted, most beautiful way for anyone in India, from a school child to a district
officer, to feel what a flood is like and learn what saves lives.**

### Phase A (next 1 to 2 months): reach everyone
1. **Full translation of story content.** Move scenario text, characters, events and template narration into
   language files; get each language reviewed by native speakers and disaster-management educators.
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
- Keep the bundle small (currently about 177 KB gzip of a 300 KB budget) so it loads on cheap phones.

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
