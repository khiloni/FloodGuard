// Hand-written subset of docs/openapi.json used by the UI. The API is the source of truth:
// the browser only displays these values and never computes outcomes.

export type Phase = 'before' | 'flood' | 'recovery';

export interface Action {
  name: string;
  params: Record<string, unknown>;
}

export interface SimEvent {
  type: string;
  tick: number;
  zone?: string | null;
  target?: string | null;
  caused_by: string;
  description: string;
  details: Record<string, any>;
}

export interface ZoneSummary {
  name?: string | null;
  population_remaining: number;
  safe_evacuated: number;
  in_transit: number;
  vulnerable_remaining: number;
  vulnerable_saved: number;
  water_depth_cm: number;
  road_flooded: boolean;
  evacuation_ordered: boolean;
  warning_level: number;
  boats_assigned: number;
  vehicles_assigned: number;
  max_depth_cm: number;
  returned: number;
  in_shelter: number;
  road_blocked: boolean;
  surveyed: boolean;
  households?: number;
  damaged_houses?: number;
  drain_blocked?: boolean;
  underpass?: boolean;
  lost?: number;
  elevation_cm?: number;
}

export interface RecoverySummary {
  shelter_supplies: number;
  supply_deliveries_left: number;
  clean_water_active: boolean;
  clean_water_kits: number;
  medical_camp_active: boolean;
  medical_teams: number;
  disease_risk: number;
  peak_disease_risk: number;
  illness_cases: number;
  illness_untreated: number;
  power_on: boolean;
  health_centre_open: boolean;
  community_trust: number;
  water_contamination?: number;
}

export interface MechanicSummary {
  type: 'none' | 'drains' | 'dam_release' | 'cyclone' | string;
  boats_at_sea: number;
  fishers_stranded: number;
  recalled: boolean;
  landfall_tick: number | null;
  release_tick: number | null;
  staggered: boolean;
  drain_crews: number;
  power_down: boolean;
}

export interface SupportSummary {
  available: boolean;
  uses_left: number;
  eta_tick: number | null;
  delay_ticks: number;
  boats: number;
  vehicles: number;
  sandbags: number;
  supply_units: number;
}

export interface Summary {
  tick: number;
  max_ticks: number;
  phase: Phase;
  flood_start_tick: number | null;
  recovery_start_tick: number | null;
  displaced: number;
  score_so_far?: number;
  residents_at_risk?: number;
  lost_total?: number;
  warnings_delivered?: number;
  difficulty?: string;
  mechanic?: MechanicSummary;
  support?: SupportSummary;
  sandbags?: number;
  recovery: RecoverySummary | null;
  water_level_cm: number;
  normal_level_cm: number;
  warning_level_cm: number;
  danger_level_cm: number;
  crest_level_cm: number;
  embankment_integrity: number;
  embankment_height_cm: number;
  embankment_breached: boolean;
  shelter: { occupancy: number; capacity: number; is_open: boolean };
  transport: {
    boats_total: number; boats_available: number; boats_in_use: number;
    vehicles_total: number; vehicles_available: number; vehicles_in_use: number;
  };
  zones: Record<string, ZoneSummary>;
}

export type Point = [number, number];

export interface Layout {
  canvas?: { width: number; height: number };
  levels?: { normal_level_cm: number; warning_level_cm: number; danger_level_cm: number; crest_level_cm: number };
  river?: { name?: string; center_path: Point[]; north_bank: Point[]; south_bank: Point[] };
  embankment?: { name?: string; segments: { id: string; start: Point; end: Point; label?: string }[] };
  zones: { id: string; name: string; x: number; y: number; width: number; height: number; elevation_cm: number; house_points: Point[] }[];
  shelters: { id: string; name: string; x: number; y: number; width: number; height: number }[];
  routes: { zone_id: string; shelter_id: string; transport_modes: string[]; waypoints: Point[] }[];
  water_body?: 'river' | 'canal' | 'sea' | string;
  decor?: {
    trees?: Point[]; hills?: Point[]; buildings?: Point[]; railway?: Point[];
    jetty?: { x: number; y: number; label?: string };
    bridges?: { x: number; y: number; label?: string }[];
    underpasses?: { x: number; y: number; label?: string }[];
    dam?: { x: number; y: number; label?: string };
    sea_boats?: { x: number; y: number; label?: string };
  };
  recovery_sites?: Record<string, { x: number; y: number; label?: string }>;
}

export interface EngineZone {
  id: string;
  name: string;
  lost: number;
  initial_population: number;
  initial_vulnerable: number;
}

export interface EngineState {
  tick: number;
  max_ticks: number;
  forecast_cm: number[];
  is_finished: boolean;
  phase: Phase;
  zones: Record<string, EngineZone>;
  npc_ids?: string[];
  scenario_id?: string;
  score?: { total_score: number } | null;
}

export interface RuleCard { id: string; title: string; guidance: string; category: string }

export interface TurnResponse {
  status: 'ok' | 'clarify' | 'rejected' | 'real_emergency';
  parsed_action: Action | null;
  clarify: { question: string; options: Action[] } | null;
  reject_reason: string | null;
  state: EngineState | null;
  summary?: Summary | null;
  events: SimEvent[];
  narration: { text: string; source: string };
  npc_messages: { npc_id: string; text: string; source: string; suggestion?: Suggestion | null }[];
  guardrail: { status: string; retries: number; fallback_reason?: string | null };
  source: string;
  llm_mode: string;
  disclaimer: string;
  cited_rulecards: RuleCard[];
}

export interface RuleCardFull extends RuleCard { keywords?: string[]; source_reference?: string }

export interface Suggestion {
  action: Action;
  tradeoff: string;
  priority: number;
  rule_card_id?: string | null;
  rule_card?: RuleCardFull | null;
}

export interface HelpResponse {
  options: Suggestion[];
  source: string;
  guardrail: { status: string; retries: number; fallback_reason?: string | null };
  llm_mode: string;
  note: string;
}

export interface NpcInfo { id: string; name: string; role: string; location?: string | null; initial_dialogue?: string | null }

export interface ScenarioInfo {
  id: string;
  name: string;
  version: string;
  total_ticks: number;
  description: string;
  layout: Layout;
  hazard_type: string;
  hazard_label: string;
  difficulty_label: string;
  hook: string;
  illustration: string;
  tick_duration_minutes: number;
  languages: string[];
  difficulties: string[];
  mechanic_type: string;
  external_support?: Record<string, number> | null;
  npcs: NpcInfo[];
  shelters: { id: string; name: string; capacity: number }[];
}

export interface Meta {
  version: string;
  disclaimer: string;
  emergency_helpline: string;
  disaster_helpline: string;
  llm_mode: string;
  llm_status: string;
  llm_provider?: string;
  llm_model?: string;
  llm_model_license?: string;
  supported_languages?: string[];
  example_commands: string[];
  example_commands_by_phase?: Partial<Record<Phase, string[]>>;
}

export interface Health { status: string; llm_mode: string; llm_status: string; version: string }

export interface SessionCreated {
  session_id: string;
  seed: number;
  state: EngineState;
  layout: Layout;
  summary: Summary;
  disclaimer: string;
}

export interface ReplayFrame { tick: number; phase: Phase; action: Action | null; summary: Summary }

export interface SessionLog {
  session_id: string;
  actions: Action[];
  events: SimEvent[];
  frames?: ReplayFrame[] | null;
}

export interface CauseEffect { tick: number | null; type: string; zone?: string | null; description?: string | null }

export interface Report {
  session_id: string;
  score: Record<string, any> & { total_score: number; details: Record<string, any> };
  final_state: EngineState;
  phases: {
    phase: Phase; label: string; reached: boolean; start_tick: number | null; end_tick: number | null;
    key_events: CauseEffect[]; score_components: Record<string, number>; score_points: number; score_max: number;
  }[];
  causal_chain: { phase: Phase; cause: CauseEffect; effect: CauseEffect; explanation: string; rule_card_ids?: string[] }[];
  rule_cards?: RuleCardFull[];
  scenario_id?: string;
  seed?: number;
  difficulty?: string;
  language?: string;
  disclaimer: string;
}
