# FloodGuard – Complete Project Documentation

An AI-powered story simulator for flood resilience. This is the single source of truth for the concept, research, feasibility, requirements, architecture and technical design. Build steps are in the companion document, *FloodGuard – Implementation Roadmap & Execution Guide*.

**Status legend:** \[Completed\] done and documented. \[In progress\] being worked on now. \[Planned\] designed but not started. No code has been written yet. Every technology marked *Proposed* is confirmed or replaced by the Phase 0 experiments.

## Status at a Glance

| Item | Status | Notes |
| --- | --- | --- |
| Domain selection and idea research | \[Completed\] | 6–7 Nov 2026 |
| Concept finalization (users, problem, impact) | \[Completed\] | 8 Nov 2026 |
| Project planning and MVP scope | \[Completed\] | 9 Nov 2026 |
| System specification (SRS) | \[Completed\] | Drafted 10 Nov, expanded in Part 2 |
| Architecture design | \[Completed\] | 11 Nov, detailed in Parts 3–4 |
| Simulation state model and action set | \[Completed\] (design only) | 12 Nov, no code yet |
| LLM, RAG and multilingual design | \[Completed\] (design only) | 13 Nov, no code yet |
| Feasibility and gap analysis | \[Completed\] | Open experiments remain (Phase 0) |
| Documentation consolidation | \[In progress\] | This document and the roadmap |
| Phase 0 experiments | \[Planned\] | See roadmap |
| Implementation (MVP and beyond) | \[Planned\] | See roadmap |
| Playtesting and evaluation | \[Planned\] | See roadmap |

**Open inputs still needed:** deadline or event, team size, compute budget, and whether an open-source LLM is mandatory. These affect model choice and scope.

---

# Part 1 – Project Overview and Feasibility

## 1.1 Project idea \[Completed\]

FloodGuard places the user inside a simulated village just hours before and during a major flood. The user is the decision-maker and talks with villagers, emergency workers, families and local authorities through an AI-driven story. An LLM generates the conversations and narration. A deterministic simulation engine calculates the consequences: evacuation success, resource shortages, infrastructure damage and lives at risk.

## 1.2 Problem statement \[Completed\]

Flood preparedness is usually taught through static warnings, brochures and generic instructions. People know floods are dangerous but rarely experience the decision pressure and trade-offs involved in protecting a community. There is no accessible practice environment where a learner makes time-pressured, multi-stakeholder decisions and sees the consequences, especially in regional Indian languages.

## 1.3 Objectives \[Completed\]

1. Let users experience the consequences of preparedness decisions and of inaction.
2. Compute every outcome (flood severity, resources, evacuation results, survival score) in a deterministic engine, never from LLM claims.
3. Use the LLM only for storytelling, dialogue, language adaptation and explanation.
4. Make the experience accessible in English and regional Indian languages.
5. End each session with a causal after-action report explaining which decisions led to which outcomes.

## 1.4 Target users and use cases \[Completed\]

| User | Use case |
| --- | --- |
| School and college students (primary) | Play a session to practise flood-response decisions |
| Community volunteers | Rehearse coordination, evacuation and communication |
| Teachers and NGO trainers (secondary) | Run the game as a classroom or workshop activity |
| Residents of flood-prone regions | Play in their own language and learn local-relevant guidance |

## 1.4a Features \[Completed\]

| Tier | Features |
| --- | --- |
| Core | Deterministic scenario engine, turn-based decisions, LLM dialogue with a small cast, outcome narration, causal after-action report |
| Supporting | RAG over verified guidance, English plus two or three Indian languages, difficulty levels, scenario variants (river, urban, flash flood) |
| Future | Voice input and output, more languages, teacher dashboard, region-specific scenario packs, offline mode |

Two refinements were made to the original concept, with reasons:

1. **Player actions are constrained to a fixed action set.** Free text is mapped to a valid action. Without this the engine cannot compute consequences deterministically.
2. **A causal after-action report is added.** It addresses a weakness of existing games, where players cannot tell which decisions worked (see 1.5).

## 1.5 Research findings \[Completed\]

Search coverage was targeted, not exhaustive.

### Existing solutions

| Solution | What it provides | Limitation or lesson |
| --- | --- | --- |
| UNDRR Stop Disasters | Online game where the player acts as a local decision-maker; scenarios include floods; limited time and budget; for learners aged 9–17 | Menu and planning driven. One reviewer found the disaster animation opaque, making it hard to tell which measures worked |
| FloodGame (2025 journal paper) | Web-based 3D serious game on flood mitigation for K-12 and college students, using real-world parameters for a chosen location | Focused on mitigation strategy, not conversation |
| Krisopolis and Hazagora | Serious games on individual preparedness and flood decision-making under uncertainty (digital and analogue) | Not dialogue-driven; no evidence found of Indic-language versions |

**Gap and differentiation.** FloodGuard differentiates on (1) conversational agency under time pressure, (2) regional-language access, (3) an India-specific village context, and (4) a transparent causal after-action report. It does not compete on graphics or hydrological realism.

### Knowledge sources for RAG

The National Disaster Management Authority (NDMA) publishes *National Disaster Management Guidelines: Management of Floods* (aimed at ministries, states and agencies preparing flood management plans) and *Management of Urban Flooding* (2010). They are planner-oriented, so they must be condensed into short citizen-level rule cards.

### Language technology

| Technology | Findings | Caveat |
| --- | --- | --- |
| Sarvam-30B and Sarvam-105B | Open-sourced in early 2026 under Apache 2.0; claimed support for all 22 official Indian languages and code-mixed input | Reports of hallucination and a mid-2025 knowledge cutoff; developers report tooling and deployment-format friction; large models need serious GPU capacity |
| Sarvam-1 (2B) | Open model covering ten Indian languages plus English | Small, so weaker at sustained roleplay; needs testing |
| IndicTrans2 (AI4Bharat) | Open-source translation covering all 22 scheduled languages; a hosted 1B variant exists on Cloudflare Workers AI | Translation can lose colloquial tone |
| Bhashini platform | Public translation and speech-recognition APIs for Indian languages | Check access terms before relying on it |
| Indic-Conformer ASR | Open-source speech recognition via Bhashini and AIKosh | Deferred to post-MVP |

## 1.6 Feasibility analysis \[Completed\]

| Component | Verdict | Key point |
| --- | --- | --- |
| Deterministic simulation engine | Achievable | Stylized teaching model, not a hydrological forecast |
| Free text to structured action | Achievable with limitations | Schema-constrained output plus validation and a button fallback |
| LLM dialogue grounded in state | Achievable with limitations | Consistency drift and invented facts need guardrails |
| RAG on verified guidance | Achievable | Requires curated rule cards |
| Open-source Indic-capable LLM | Achievable with limitations, needs experiments | Quality in Gujarati and Hindi must be measured |
| Translation layer | Achievable | Open-source or hosted options exist |
| Voice input and output | Achievable with limitations (deferred) | Post-MVP |
| Personalized preparedness guidance | Achievable only with a design constraint | Select and rephrase rule cards; never author advice freely |
| Learning impact | Requires experimentation | Needs playtesting before any claim |

## 1.7 Verdict \[Completed\]

Feasible as a focused MVP. The engine and RAG are low risk. Indic-language dialogue quality and safe guidance generation are the two items that need experiments. Build the engine first, the LLM layer second, translation third.

---

# Part 2 – System Requirements Specification

## 2.1 Purpose and scope \[Completed\]

FloodGuard is a web-based educational simulation. It covers scenario loading, turn-based decisions, a deterministic flood-response simulation, LLM-driven dialogue and narration, multilingual interaction, retrieval-grounded guidance and an after-action report. It is not a forecasting tool and must never be presented as emergency instruction.

## 2.2 Actors

| Actor | Description |
| --- | --- |
| Player | Plays a session as village decision-maker |
| Content author | Writes scenario packs and rule cards (initially the project team) |
| Educator (future) | Views class results |
| System components | Engine, LLM service, retrieval service, translation service |

## 2.3 Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Load a scenario pack (village layout, forecast curve, characters, resources) and initialize state | MVP |
| FR-2 | Create, resume and end sessions with a stored seed | MVP |
| FR-3 | Support multiple scenario packs and difficulty levels | Core |
| FR-4 | Accept player input as buttons or free text | MVP |
| FR-5 | Map free text to exactly one action from the fixed action set, validated against current state | MVP |
| FR-6 | Reject or request clarification for invalid or ambiguous actions | MVP |
| FR-7 | Show a live dashboard (water level, resources, evacuation progress, time left) | MVP |
| FR-8 | Advance the simulation in time steps after each action | MVP |
| FR-9 | Compute water level, zone flooding, evacuation, resource use, infrastructure status and residents at risk | MVP |
| FR-10 | Produce identical outcomes for identical scenario, actions and seed | MVP |
| FR-11 | Maintain a structured event log of every action and outcome | MVP |
| FR-12 | Generate character dialogue grounded in current state | MVP |
| FR-13 | Generate turn narration from engine events only | MVP |
| FR-14 | Validate all LLM text against engine state and rule cards before display | MVP |
| FR-15 | Retrieve rule cards relevant to the current situation | Core |
| FR-16 | Fall back to template text if validation fails repeatedly | MVP |
| FR-17 | Support English plus at least one Indian language in the MVP | MVP |
| FR-18 | Detect input language and reply in the player's chosen language | Core |
| FR-19 | Compute a final survival score from defined components | MVP |
| FR-20 | Generate a causal after-action report linking decisions to outcomes and rule cards | Core |
| FR-21 | Let authors add scenario packs and rule cards without code changes | Core |
| FR-22 | Replay a session from its log | Core |

## 2.4 Non-functional requirements

| Area | Requirement |
| --- | --- |
| Determinism | Same scenario, actions and seed give the same outcome |
| Responsiveness | Turn latency targets are set after Phase 0 benchmarks; the engine step itself must be near-instant |
| Safety | The LLM never states numbers, outcomes or advice unsupported by state or rule cards |
| Privacy | Anonymous sessions, no personal data collected |
| Accessibility | Low-bandwidth, mobile-friendly web interface; readable text and clear contrast |
| Reliability | The game must stay playable when the LLM or translation service fails (template fallback) |
| Maintainability | Engine isolated from AI layers; scenario data kept outside code |
| Tone | Age-appropriate handling of simulated harm; educational disclaimer displayed |

## 2.5 Assumptions, constraints and out of scope

- **Assumptions:** players have a browser and an internet connection; initial content is authored by the team; one verified-language experience is shipped first.
- **Constraints:** open-source LLMs are specified in the project brief; compute budget and timeline are not yet confirmed.
- **Out of scope for the MVP:** voice, multiplayer, 3D visuals, real-time hydrological modelling, live weather or flood-forecast data, user accounts, teacher dashboard.

---

# Part 3 – System Architecture and Workflow

## 3.1 Architecture overview \[Completed design\]

```
Player (web UI: English / Indian languages)
   | free text or buttons
   v
[API gateway: FastAPI]
   v
[Language layer]      detect language, translate to working language
   v
[Action parser]       LLM -> structured action -> validator
   v
[Simulation engine]   <- scenario pack
   | new state + events
   v
[Dialogue + narration] LLM <- state facts + persona + rule cards (RAG)
   v
[Guardrail validator] facts and numbers must match state
   v
[Language layer]      translate to player language
   v
[UI] ... session end -> [After-action report] <- event log
```

## 3.2 Components and responsibilities

| Component | Responsibility | Depends on |
| --- | --- | --- |
| Frontend | Chat, action buttons, dashboard, language selector, report view | API |
| API layer | Session handling, request routing, validation of requests | All services |
| Language layer | Language detection, translation in and out | Translation model |
| Action parser | Converts free text to one structured action | LLM, action schema |
| Simulation engine | Owns all state and rules; authoritative for outcomes | Scenario pack only |
| Dialogue and narration service | Character replies and turn narration | LLM, state facts, retrieval |
| Retrieval service | Returns relevant rule cards | Vector store, embeddings |
| Guardrail validator | Blocks unsupported numbers, names and advice | State, rule cards |
| Report generator | Builds the causal chain from the event log | Event log, rule cards |
| Storage | Sessions, turns, logs, rule cards | Database |

## 3.3 Turn workflow

1. Player submits input.
2. The language layer normalizes it to the working language.
3. The parser returns a structured action.
4. The validator checks the action is legal now; if not, the player is asked to clarify.
5. The engine advances one time step and returns new state and events.
6. Retrieval returns rule cards relevant to the events.
7. The dialogue and narration service generates text from state facts, events and cards.
8. The guardrail validates; on failure it retries up to a fixed limit, then uses template text.
9. The language layer translates the output.
10. The UI updates the dashboard, the story and the log.

## 3.4 Session lifecycle

| Stage | Description |
| --- | --- |
| Setup | Choose scenario, difficulty and language; seed is stored |
| Briefing | Narrator introduces the village and the forecast |
| Play | Turns repeat until the flood peak passes or the player ends the session |
| Resolution | Final state is computed and the score is calculated |
| Debrief | After-action report with causal chain, score breakdown and linked rule cards |
| Replay | Session can be replayed from the log |

---

# Part 4 – Complete Technical Documentation

All technology choices are *Proposed* until the Phase 0 experiments confirm them. Numeric values in examples are illustrative placeholders to be set during scenario design.

## 4.1 Technology stack

| Layer | Proposed | Why | Alternatives |
| --- | --- | --- | --- |
| Backend | Python 3.11+, FastAPI | ML ecosystem, async, typed request models | Django |
| Data models | Pydantic | Validates state, actions and LLM output | dataclasses |
| Simulation engine | Pure Python module, no network or LLM access | Deterministic and unit-testable | None needed |
| LLM serving | vLLM or a hosted open-weights endpoint | Batching and an OpenAI-compatible API | llama.cpp or Ollama for small models |
| LLM candidates | Sarvam-30B, Sarvam-1 (2B), one general small open model | Indic coverage versus hardware cost | Decided in Phase 0 |
| Translation | IndicTrans2 (self-hosted or hosted) | Open-source, 22 languages | Bhashini APIs (check terms) |
| Embeddings | A multilingual embedding model | Cross-language retrieval | Verify Gujarati and Hindi quality before adopting |
| Vector store | Chroma for MVP, pgvector later | Simple start, same database later | FAISS |
| Database | SQLite for MVP, PostgreSQL later | Zero setup, then production-grade | None |
| Frontend | React (Vite or Next.js) as a PWA | Low-bandwidth friendly, mobile ready | Flutter |
| Testing | pytest, Hypothesis, Playwright | Unit, property-based and UI tests | None |
| Packaging and CI | Docker, Docker Compose, GitHub Actions | Reproducible environments | None |

## 4.2 Simulation engine \[Planned\]

### Design principles

- The engine is one pure function: `step(state, action, rng) -> (new_state, events)`. No I/O, no LLM calls.
- Randomness comes only from a seeded random generator whose seed is stored in the session.
- State snapshots are immutable. Every number the player sees originates here.
- Rules and numbers live in the scenario pack, not in code.

### State model

| Group | Fields |
| --- | --- |
| Time | tick, tick length (initial 30 minutes), ticks to forecast peak |
| Water | river level, forecast curve, warning and danger thresholds, rise rate |
| Zones | elevation, population, households, vulnerable residents (elderly, disabled, young children, pregnant), status (safe, warned, evacuating, flooded) |
| Resources | boats, vehicles, sandbags, food packets, medical kits, volunteers |
| Shelters | capacity, occupancy, elevation, supplies |
| Infrastructure | embankment integrity, roads and bridges, power, communications, health centre |
| Information and trust | warning delivered per zone and channel, community trust, compliance estimate |
| Evacuation | evacuated, in transit, remaining, vulnerable still at risk |
| History | ordered actions with tick, parameters and resulting events |

### Scenario pack (illustrative)

```
id: village-river-01
title: Riverside village, river flood
tick_minutes: 30
total_ticks: 24
forecast:
  river_level_m: [2.1, 2.3, 2.8, 3.4, 4.0]   # one value per tick, truncated here
  warning_level_m: 3.5
  danger_level_m: 4.5
zones:
  - id: ward-1
    elevation_m: 3.0
    population: 540
    vulnerable: {elderly: 40, disabled: 8, young_children: 55, pregnant: 6}
resources: {boats: 2, vehicles: 3, sandbags: 400, food_packets: 800, volunteers: 25}
shelters:
  - {id: school-1, capacity: 300, elevation_m: 8.0}
npcs: [village_head, rescue_worker, family_member]
```

### Actions

| Action | Parameters | Main effect |
| --- | --- | --- |
| issue\_warning | zone, channel | Raises warned status and compliance for that zone; reach depends on channel and language |
| order\_evacuation | zone | Starts evacuation of willing residents, limited by transport |
| assign\_transport | zone, vehicle or boat count | Sets evacuation capacity per tick |
| prioritize\_vulnerable | zone | Moves vulnerable residents first; slows total throughput |
| open\_shelter | site | Makes capacity available |
| distribute\_supplies | zone, item | Uses resources; reduces supply shortage risk |
| reinforce\_embankment | sandbags, location | Slows integrity loss |
| request\_external\_support | type | Support arrives after a scenario-defined delay |
| consult\_npc | npc | Returns that character's knowledge; may change trust through engine rules |
| wait | none | Advances time |

Every action has preconditions (enough resources, valid target, shelter open). Invalid actions are rejected with a reason.

### Tick update order

1. Advance the water level along the forecast curve, adjusted by embankment integrity.
2. Update zone status; mark zones flooded when water exceeds their threshold.
3. Resolve evacuation.
4. Consume resources and update shelter occupancy.
5. Degrade or fail infrastructure at thresholds.
6. Recompute residents at risk and append typed events.

Evacuation rule (initial design, weights tuned in testing):

```
willing    = remaining * compliance
moved      = min(transport_capacity, willing, remaining_eligible)
compliance = clamp(base + w_warning*warned + w_trust*trust
                   + w_language*language_reach - w_delay*late_ticks, 0, 1)
```

### Events, scoring and difficulty

- **Events.** Every event is typed (WaterRose, ZoneFlooded, EvacuationProgress, ResourceDepleted, EmbankmentBreached, WarningDelivered, SupportArrived) and stores the action or condition that caused it. This powers the after-action report.
- **Scoring.** Survival score (0–100) is a weighted sum of residents safe, vulnerable residents protected, response time, resource efficiency and infrastructure preserved. Weights are initial values tuned in testing.
- **Difficulty levers.** Forecast lead time, starting resources, baseline trust, embankment strength and communication reliability.

## 4.3 NPCs \[Planned\]

| NPC | Role | Typical information |
| --- | --- | --- |
| Village head | Local authority | Layout, residents, community concerns |
| Rescue worker | Emergency responder | Resource status, access and boat availability |
| Family member | Vulnerable household voice | Personal urgency, who is stuck, health needs |
| Later additions | Health worker, teacher, district official | Medical needs, school shelter, external support timing |

**Persona definition:** id, name, role, personality, goals, knowledge scope (which zones and facts they can know), speech style per language, allowed topics.

**Rules**

- Each NPC receives only the facts its knowledge scope allows. Gaps and stale information are set by the engine, never invented by the LLM.
- NPCs may express emotion, urgency and requests and may suggest an action. A suggestion never executes by itself.
- Trust changes come from engine rules triggered by the player's actions, not from what the LLM says.
- Conversation context is the last few turns plus an engine-generated summary.

## 4.4 LLM integration \[Planned\]

| Role | LLM does | LLM never does |
| --- | --- | --- |
| Action parsing | Maps free text to a structured action | Decides if the action succeeds |
| Character dialogue | Voices NPCs from persona and facts | States numbers or risks not supplied |
| Narration | Describes engine events | Adds or changes outcomes |
| Guidance | Rephrases and translates retrieved rule cards | Writes safety advice from scratch |

**Prompt contract.** Each call receives: persona, facts\_allowed, events\_this\_turn, rule\_cards, language and register, and constraints. Output is structured (text plus the ids of rule cards used) so validation is reliable. Player text is passed as delimited data, never as instructions.

**Guardrail validator**

1. Extract numbers, units and times and check each against facts\_allowed.
2. Check that named zones and characters exist in the scenario.
3. Check that guidance statements correspond to the cited rule cards.
4. Block invented outcomes (for example claiming a resident died or survived when no such event exists).
5. Check language and length.

On failure the service retries up to a fixed number of times with the violation as feedback, then falls back to template text so the game never blocks.

**Parameters.** Low temperature for action parsing; moderate for dialogue and narration.

**Phase 0 model selection criteria:** language fidelity, in-character consistency, format adherence, latency and memory footprint.

## 4.5 RAG \[Planned\]

**Corpus.** Rule cards with id, title, short body, topic tags, applicable phase (before, during, after), audience, source reference, version and language variants. Topics include early warning, evacuation priorities for vulnerable residents, safe shelters, safe water and health, electrical safety, crossing floodwater, communication and post-flood hygiene.

**Authoring.** Extract from NDMA guidance, rewrite as short citizen-level cards, have them reviewed, and version them. Confirm the reuse terms of the source material.

**Retrieval.** Build the query from this turn's events and the conversation topic. Embed it, filter by phase and tags, and return the top few cards above a similarity threshold.

**Provenance.** Every card keeps its source reference. The after-action report shows which cards back each lesson.

**Evaluation.** Labeled queries per language with hit-at-k measurement.

## 4.6 Translation and multilingual \[Planned\]

| Mode | Flow | Trade-off |
| --- | --- | --- |
| A: direct generation | LLM writes in the target language | Natural tone if the model is strong; quality varies by language |
| B: pivot via English | LLM writes in English, a translation model converts | More predictable; may lose colloquial tone |

- Phase 0 decides the mode per language.
- A glossary of flood terms per language keeps terminology consistent. Numbers and names are protected with placeholders during translation.
- Use Unicode fonts that cover each supported script. Right-to-left support is not needed until a language that requires it is added.
- A language ships only after review by a native speaker.
- Code-mixed input is handled by the action parser and tested explicitly.

## 4.7 Database \[Planned\]

```
sessions(id, scenario_id, scenario_version, seed, language, difficulty,
         status, created_at, ended_at)
turns(id, session_id, tick, player_input, parsed_action, state_after,
      narration, created_at)
events(id, session_id, turn_id, type, payload, caused_by)
npc_messages(id, session_id, turn_id, npc_id, text, language,
             cited_cards, guardrail_status)
rule_cards(id, version, title, body, tags, phase, source_ref)
rule_card_translations(card_id, language, body, reviewed)
reports(id, session_id, score, breakdown, causal_chain, created_at)
```

Scenario packs are versioned files. A session stores the scenario id and version so it can be replayed exactly.

## 4.8 API \[Planned\]

Versioned under /api/v1, JSON requests and responses.

| Method and path | Purpose |
| --- | --- |
| GET /scenarios | List available scenarios |
| POST /sessions | Create a session (scenario, difficulty, language) |
| GET /sessions/{id}/state | Current dashboard state |
| POST /sessions/{id}/turns | Submit input; returns new state, events, narration and NPC messages |
| POST /sessions/{id}/npc/{npc\_id}/messages | Talk to a character |
| GET /sessions/{id}/log | Full event log |
| GET /sessions/{id}/report | Score and after-action report |
| POST /sessions/{id}/end | End the session |
| GET /health | Service and dependency health |

Errors return a code and a player-safe message. Streaming narration over server-sent events is an optional later addition.

## 4.9 Security and privacy \[Planned\]

| Concern | Measure |
| --- | --- |
| Prompt injection | Engine is authoritative; player text is delimited data; parser output is validated against the action schema |
| Abuse and cost | Rate limits, input length limits, request size limits |
| Privacy | Random anonymous session ids, no personal data collected, logs without identifiers, defined retention period (length to be decided) |
| Safe content | Guardrail validator, age-appropriate handling of simulated harm, visible educational disclaimer |
| Web security | CORS restrictions, HTTPS, no secrets in the frontend, pinned and audited dependencies |
| Licensing | Check model licences and the reuse terms of source guidance |

## 4.10 Deployment and operations \[Planned\]

- **Environments:** local development, staging, public demo.
- **Services:** frontend, API, LLM service, translation service, vector store and database, each as a container. Docker Compose for local development.
- **Compute:** the LLM service needs GPU capacity sized to the model chosen in Phase 0. A hosted open-weights endpoint is the fallback.
- **Configuration:** environment variables for model endpoints and limits.
- **Observability:** structured logs, per-turn timings, guardrail failure rate and fallback rate.
- **Scaling:** stateless API with state in the database; cache narration for repeated event patterns per language.
- **CI/CD:** run engine tests, parser tests and linting on every change; build container images on merge.

## 4.11 Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Hallucinated dialogue or advice | State-injected prompts, rule cards, guardrail validator, template fallback |
| Uneven Indic language quality | Ship only reviewed languages; compare direct and pivot modes |
| Compute cost and latency | Smaller model option, caching, hosted fallback, short turns |
| Over-claiming realism or impact | State the model is stylized; playtest before claiming learning outcomes |
| Parser misreads on code-mixed input | Test set, button fallback, clarification prompts |
| Sensitive content | Tone guidelines, content note, age-appropriate framing |
| Scope growth | Hold the MVP scope in Part 2 and the roadmap |

## 4.12 Decision log and open questions

| Decision | Status |
| --- | --- |
| Engine is pure, deterministic and authoritative | Decided |
| Fixed action set with validation | Decided |
| Guidance only from curated rule cards | Decided |
| Causal after-action report in scope | Decided |
| LLM model | Open (Phase 0) |
| Direct versus pivot translation per language | Open (Phase 0) |
| First Indian language for the MVP | Open; choose one a native speaker can review (Gujarati or Hindi are natural candidates) |
| Frontend framework | Open |
| Compute and hosting | Open; depends on budget |
| Deadline, team size, open-source mandate | Open; needs confirmation |
