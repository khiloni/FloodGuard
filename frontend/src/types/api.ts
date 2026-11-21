export const ActionName = {
  ISSUE_WARNING: 'issue_warning',
  ORDER_EVACUATION: 'order_evacuation',
  ASSIGN_TRANSPORT: 'assign_transport',
  PRIORITIZE_VULNERABLE: 'prioritize_vulnerable',
  OPEN_SHELTER: 'open_shelter',
  REINFORCE_EMBANKMENT: 'reinforce_embankment',
  CONSULT_NPC: 'consult_npc',
  WAIT: 'wait',
} as const;

export type ActionName = (typeof ActionName)[keyof typeof ActionName];

export interface Action {
  name: ActionName;
  params: Record<string, any>;
}

export interface ZoneState {
  id: string;
  name: string;
  elevation_cm: number;
  initial_population: number;
  population_remaining: number;
  initial_vulnerable: number;
  vulnerable_remaining: number;
  safe_evacuated: number;
  vulnerable_saved: number;
  in_transit: number;
  lost: number;
  water_depth_cm: number;
  evacuation_ordered: boolean;
  warning_level: number;
  prioritize_vulnerable: boolean;
  boats_assigned: number;
  vehicles_assigned: number;
  road_flooded: boolean;
}

export interface ShelterState {
  id: string;
  name: string;
  elevation_cm: number;
  capacity: number;
  current_occupancy: number;
  is_open: boolean;
}

export interface ResourceState {
  total_boats: number;
  available_boats: number;
  boat_capacity: number;
  total_vehicles: number;
  available_vehicles: number;
  vehicle_capacity: number;
  sandbags: number;
}

export interface EmbankmentState {
  height_cm: number;
  integrity: number;
  breached: boolean;
  reinforced_count: number;
}

export interface ScoreBreakdown {
  total_score: number;
  residents_safe_score: number;
  vulnerable_protected_score: number;
  response_time_score: number;
  resource_efficiency_score: number;
  infrastructure_preserved_score: number;
  details: Record<string, any>;
}

export interface State {
  scenario_id: string;
  scenario_version: string;
  tick: number;
  max_ticks: number;
  water_level_cm: number;
  forecast_cm: number[];
  zones: Record<string, ZoneState>;
  shelters: Record<string, ShelterState>;
  resources: ResourceState;
  embankment: EmbankmentState;
  first_warning_tick: number | null;
  first_evacuation_tick: number | null;
  is_finished: boolean;
  score: ScoreBreakdown | null;
}

export interface TurnEvent {
  type: string;
  tick: number;
  description: string;
  caused_by: string;
  details: Record<string, any>;
}

export interface RuleCard {
  id: string;
  title: string;
  category: string;
  guidance: string;
  keywords: string[];
  source_reference: string;
}

export interface TurnResponse {
  status: 'ok' | 'clarify' | 'rejected' | 'real_emergency';
  parsed_action: Action | null;
  clarify: {
    question: string;
    options: Action[];
  } | null;
  reject_reason: string | null;
  state: State;
  events: TurnEvent[];
  narration: {
    text: string;
    source: string;
  };
  npc_messages: Array<{
    npc_id: string;
    text: string;
    source: string;
  }>;
  guardrail: {
    status: string;
    retries: number;
  };
  disclaimer: string;
  cited_rulecards?: RuleCard[];
}
