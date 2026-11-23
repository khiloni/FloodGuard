# Post-Flood Phase Design (Part 2)

Status: implemented as designed (owner asked for all three parts in one run; this doc
was written before the code and is the contract for it).

## 1. Goals and constraints
- One session now covers **before**, **during** and **after** the flood.
- The engine stays pure: `step(state, action, rng) -> (state, events)`, no I/O, seeded RNG
  (the RNG is still unused, so outcomes depend only on scenario + actions).
- All **new** engine and scoring arithmetic is integer-only (`//`, explicit half-up rounding).
  The existing flood movement code is left untouched apart from the phase gate, so pre-flood
  and flood behaviour do not change.
- `scenario_version` goes from `1.0.0` to `2.0.0`. The scenario file grows from 24 to 30 ticks.
- Every new number comes from the scenario YAML (`phases`, `recovery`), not from code.

## 2. Phases
| Phase value | Timeline label | Starts when | Ends when |
| --- | --- | --- | --- |
| `before` | Before | tick 0 | river level reaches `phases.flood_starts_at_cm` (warning level, 300 cm) |
| `flood` | During | first such tick | the forecast peak has passed **and** level drops below `phases.recovery_below_cm` (danger level, 380 cm) |
| `recovery` | After | first such tick | session end (`total_ticks`) |

For `village-river-01`: before = ticks 0-5, flood = ticks 6-16 (peak 475 cm at tick 12),
recovery = ticks 17-30. Ward 2 dries out at tick 18 and Ward 1 at tick 23, so the recovery is
staggered by design.

Phase is monotonic (never moves backwards). The session no longer ends early when every
resident has been evacuated: the flood and the recovery still have to be managed. It ends at
`total_ticks` or through `POST /end`.

## 3. State changes
`State` (new fields, defaults keep old payloads valid):
- `phase: str` (`before` | `flood` | `recovery`)
- `flood_start_tick: Optional[int]`, `recovery_start_tick: Optional[int]`
- `recovery: RecoveryState`

`ZoneState` (new fields with defaults):
- `max_depth_cm: int` (deepest water seen; drives damage)
- `returned: int` (residents moved back home)
- `road_blocked: bool` (debris after the water drops; set at recovery start if `max_depth_cm >= 30`)
- `surveyed: bool`

`RecoveryState` (all ints/bools):
| Field | Meaning |
| --- | --- |
| `shelter_supplies` | supply units in the shelter (consumed in every phase while people are sheltered) |
| `supply_deliveries_left` | deliveries still available for `distribute_supplies` |
| `supply_shortfall_ticks` | ticks with people in the shelter and no supplies |
| `supplies_low_warned` | one-shot flag for the low-supply event (re-armed by a delivery) |
| `clean_water_kits`, `clean_water_active` | purification kits left; clean water running |
| `medical_teams`, `medical_camp_active` | teams left; camp running |
| `disease_risk`, `peak_disease_risk` | waterborne-disease risk 0-100 and its peak |
| `illness_cases`, `illness_treated` | cumulative reported and treated cases |
| `power_on`, `health_centre_open` | power status; health centre reopens when power is restored |
| `community_trust` | 0-100 |

`displaced residents` = shelter occupancy (`sum(safe_evacuated - returned)`); it is exposed in the
summary rather than stored twice.

## 4. Actions
Phase rules: flood-response actions (`issue_warning`, `order_evacuation`, `assign_transport`,
`prioritize_vulnerable`, `reinforce_embankment`) are rejected in `recovery`. Recovery actions
are rejected before `recovery`, except `distribute_supplies` (valid whenever a shelter is open).
`open_shelter`, `consult_npc` and `wait` are valid in every phase.

| Action | Params | Preconditions | Effect |
| --- | --- | --- | --- |
| `search_and_rescue` | `zone` | recovery; zone has stranded residents; open shelter with space | moves up to `boats*boat_capacity` (+ `vehicles*vehicle_capacity` if the road is passable) stranded residents, vulnerable first, into the shelter; trust +2 |
| `distribute_supplies` | `shelter_id` (optional) | a shelter is open; deliveries left | supplies + `units_per_delivery`; re-arms the low-supply warning |
| `provide_clean_water` | - | recovery; kit left; not already active | `clean_water_active = true` (permanent) |
| `run_medical_camp` | - | recovery; team left; not already active | `medical_camp_active = true` (permanent) |
| `restore_power` | - | recovery; power off; at least one road cleared, or no road blocked | `power_on`, `health_centre_open`; trust +3 |
| `clear_roads` | `zone` | recovery; road blocked; zone water depth < 30 cm | `road_blocked = false` |
| `damage_survey` | `zone` | recovery; zone was flooded; not surveyed | `surveyed = true` |
| `return_residents` | `zone` | recovery; zone dry (depth 0); road not blocked; surveyed (if the zone flooded); residents of that zone in the shelter | moves up to `return_batch_per_turn` home; shelter occupancy drops; trust +3 |

At recovery start every boat and vehicle is released back to the depot (assignments reset).

## 5. Tick order
1. Validate and apply the action.
2. Advance water along the forecast (unchanged).
3. Embankment overflow and breach (unchanged).
4. Zone depth and roads (unchanged) + update `max_depth_cm`; emit `water_receded` when a zone dries.
5. Automatic evacuation movement: **only before recovery** (in recovery, stranded people need `search_and_rescue`).
6. Casualties (unchanged rule; cannot trigger after recovery because water is shallow).
7. Phase transition check; on entering recovery, initialise recovery state (section 6).
8. Shelter supplies: `use = ceil(occupancy / people_per_supply_unit)` while occupancy > 0.
9. Recovery tick rules (only on recovery ticks after the start tick): disease, illness, trust.
10. Finish check and score.

## 6. Recovery rules (integers, scenario-configurable)
On entering recovery:
- `power_on = not breached and no zone with max_depth_cm >= 30`; `health_centre_open = power_on`
- `disease_risk = clamp(base + per_flooded_zone * zones_with_max_depth>0 + breach_bonus * breached)`
- `community_trust = clamp(initial + early_warning_bonus [warning by tick 6] - losses_penalty [any lost]
  - breach_penalty [breached] - supplies_ran_out_penalty [shortfall during flood])`

Each later recovery tick, with `crowded = occupancy*100 >= capacity*crowding_pct`:
```
disease_risk += rise_per_tick + crowding_rise*crowded + no_supplies_rise*(supplies==0 and occupancy>0)
              - clean_water_drop*clean_water_active - medical_camp_drop*medical_camp_active
disease_risk  = clamp(0, 100)
if disease_risk >= high_threshold and not medical_camp_active: illness_cases += max(1, (disease_risk-50)//10)
if medical_camp_active: illness_treated += min(illness_cases - illness_treated, treat_per_tick)
trust += -3*(supplies==0 and occupancy>0) - 2*(any stranded) - 2*(disease_risk>=high) + clean_water + medical_camp + power_on
```
Each update is monotonic in the previous risk and in the "active" flags, which is what the
metamorphic tests rely on.

## 7. Events (typed, all with `caused_by`)
New `EventType`s: `phase_changed`, `water_receded`, `search_and_rescue_completed`,
`supplies_distributed`, `shelter_supplies_low`, `shelter_supplies_exhausted`,
`clean_water_provided`, `medical_camp_opened`, `disease_risk_high`, `illness_reported`,
`illness_treated`, `power_restored`, `health_centre_reopened`, `road_cleared`,
`damage_surveyed`, `residents_returned`.

Every event (old and new) now carries `details.phase`, the phase at the moment it happened, so
the timeline and report can group by phase without schema changes in SQLite. Derived events
name their cause in `caused_by`, e.g. `disease_risk_high` -> "No clean water since recovery began".

## 8. Scoring (weights still sum to 100)
| Component | Old | New | Rule |
| --- | --- | --- | --- |
| Residents safe | 40 | 30 | safe/threatened minus losses penalty |
| Vulnerable protected | 25 | 20 | vulnerable saved/threatened vulnerable |
| Response time | 15 | 10 | warning by tick 3/6/10 -> 5/3/1; evacuation by 5/8/12 -> 5/3/1 |
| Resource efficiency | 10 | 7 | shelter opened 3, transport used 2, embankment reinforced 2 |
| Infrastructure preserved | 10 | 8 | no breach and integrity >= 80/50/>0 -> 8/6/3; breach 0 |
| **Public health** | - | 8 | `8*(100-peak_disease_risk)/100 - untreated_illness//5`, floor 0 |
| **Essential services** | - | 6 | clean water 2 + power on 2 + `2*cleared/blocked` roads |
| **Safe return** | - | 6 | `6*returned/safe_evacuated` |
| **Community trust** | - | 5 | `5*trust/100` |

All ratios use integer half-up rounding: `(2*num*w + den) // (2*den)`. Recovery components
are 0 if the session ends before recovery starts.

## 9. Report: causal chain across three phases
`GET /report` keeps its fields and adds:
- `phases`: for each phase, its tick range, the key events and the score components it drives.
- `causal_chain`: ordered links `{cause, effect, explanation}`, built deterministically from the
  event log by fixed rules (for example: early warning -> first evacuation; road inundated ->
  vehicles blocked; breach -> power out at recovery; no clean water -> disease risk high;
  road cleared -> power restored -> health centre reopened; damage survey -> residents returned;
  supplies exhausted -> trust falls). Text is template-generated, never by the LLM.

## 10. Other touch points
- Parser: keywords for the 8 recovery actions (English + common Hindi words), avoiding words that
  existing tests rely on (for example "clear out ward 1" stays an evacuation).
- LLM fallback parser: action list and parameter validation for the new actions.
- Narration/NPC templates: phase-aware lines; rule cards RC-06..RC-09 for recovery topics.
- Validator: `search_and_rescue_completed` counts as a rescue event; new numbers enter `facts_allowed`.
- API: `summary` gains `phase`, `recovery`, per-zone recovery fields; `meta.example_commands`
  gains recovery examples; `docs/openapi.json` regenerated.
- Layout: `layout.recovery_sites` (water point, medical camp, substation, supply depot,
  health centre) for Part 3 animations.

## 11. Test plan
- **Invariants** (randomised over all 16 actions, 50 seeds): population conservation,
  `returned <= safe_evacuated`, `shelter occupancy == sum(safe - returned)` and `<= capacity`,
  risk/trust in 0-100, supplies and stocks >= 0, phase monotonic, every state value is an int
  or bool (no floats), score components sum to total and each is within its weight.
- **Phase gating**: flood actions rejected in recovery and recovery actions before it.
- **Metamorphic**: clean water earlier never raises disease risk at any later tick; medical camp
  earlier never raises untreated illness; distributing supplies never lowers trust; prioritising
  vulnerable never saves fewer vulnerable (kept).
- **Golden playbooks**: do-nothing < 30; expert full three-phase playbook >= 80; a flood-only
  expert scores no more than 75 (proves recovery matters).
- **Determinism and replay**: 100 identical runs over all 30 ticks give one hash; API replay
  from `/log` reproduces the final state including recovery fields.
