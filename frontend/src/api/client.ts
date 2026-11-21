import { State, TurnResponse, Action } from '../types/api';

const API_BASE = '/api/v1';

export async function fetchMeta() {
  try {
    const res = await fetch(`${API_BASE}/meta`);
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Backend offline, using fallback meta');
  }
  return {
    version: '1.0.0',
    disclaimer:
      'This is an educational simulation, not emergency guidance. In a real flood emergency in India, call 112.',
    emergency_helpline: '112',
    disaster_helpline: '1078',
    supported_languages: ['en'],
    llm_mode: 'template',
  };
}

export async function createSession(scenario_id: string = 'village-river-01') {
  try {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id, difficulty: 'standard', language: 'en' }),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Backend unavailable, initializing mock session');
  }
  return getMockInitialSession();
}

export async function submitTurn(sessionId: string, inputPayload: any): Promise<TurnResponse> {
  try {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: inputPayload }),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Backend unavailable, running mock turn');
  }
  return runMockTurn(inputPayload);
}

export async function fetchReport(sessionId: string) {
  try {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/report`);
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Backend report error');
  }
  return null;
}

// Built-in offline mock state for zero-dependency standalone operation
let mockState: State = {
  scenario_id: 'village-river-01',
  scenario_version: '1.0.0',
  tick: 0,
  max_ticks: 24,
  water_level_cm: 160,
  forecast_cm: [
    160, 180, 205, 235, 270, 305, 340, 375, 410, 440, 465, 475, 470, 455, 430, 400, 370, 340, 310, 280, 250, 225, 200, 180
  ],
  zones: {
    'ward-1': {
      id: 'ward-1',
      name: 'Ward 1 (Lowland Riverside)',
      elevation_cm: 220,
      initial_population: 120,
      population_remaining: 120,
      initial_vulnerable: 30,
      vulnerable_remaining: 30,
      safe_evacuated: 0,
      vulnerable_saved: 0,
      in_transit: 0,
      lost: 0,
      water_depth_cm: 0,
      evacuation_ordered: false,
      warning_level: 0,
      prioritize_vulnerable: false,
      boats_assigned: 0,
      vehicles_assigned: 0,
      road_flooded: false,
    },
    'ward-2': {
      id: 'ward-2',
      name: 'Ward 2 (Market Settlement)',
      elevation_cm: 360,
      initial_population: 180,
      population_remaining: 180,
      initial_vulnerable: 40,
      vulnerable_remaining: 40,
      safe_evacuated: 0,
      vulnerable_saved: 0,
      in_transit: 0,
      lost: 0,
      water_depth_cm: 0,
      evacuation_ordered: false,
      warning_level: 0,
      prioritize_vulnerable: false,
      boats_assigned: 0,
      vehicles_assigned: 0,
      road_flooded: false,
    },
    'ward-3': {
      id: 'ward-3',
      name: 'Ward 3 (Highland Ridge)',
      elevation_cm: 520,
      initial_population: 100,
      population_remaining: 100,
      initial_vulnerable: 15,
      vulnerable_remaining: 15,
      safe_evacuated: 0,
      vulnerable_saved: 0,
      in_transit: 0,
      lost: 0,
      water_depth_cm: 0,
      evacuation_ordered: false,
      warning_level: 0,
      prioritize_vulnerable: false,
      boats_assigned: 0,
      vehicles_assigned: 0,
      road_flooded: false,
    },
  },
  shelters: {
    school: {
      id: 'school',
      name: 'Government High School Shelter',
      elevation_cm: 500,
      capacity: 320,
      current_occupancy: 0,
      is_open: false,
    },
  },
  resources: {
    total_boats: 2,
    available_boats: 2,
    boat_capacity: 15,
    total_vehicles: 3,
    available_vehicles: 3,
    vehicle_capacity: 20,
    sandbags: 400,
  },
  embankment: {
    height_cm: 380,
    integrity: 100,
    breached: false,
    reinforced_count: 0,
  },
  first_warning_tick: null,
  first_evacuation_tick: null,
  is_finished: false,
  score: null,
};

function getMockInitialSession() {
  return {
    session_id: 'mock-session-001',
    seed: 42,
    state: JSON.parse(JSON.stringify(mockState)),
    disclaimer: 'Educational simulation mode active. In emergency call 112.',
  };
}

function runMockTurn(inputPayload: any): TurnResponse {
  const currentTick = mockState.tick + 1;
  const newWater = mockState.forecast_cm[Math.min(currentTick - 1, mockState.forecast_cm.length - 1)];

  mockState = {
    ...mockState,
    tick: currentTick,
    water_level_cm: newWater,
    is_finished: currentTick >= mockState.max_ticks,
  };

  return {
    status: 'ok',
    parsed_action: { name: 'wait', params: {} },
    clarify: null,
    reject_reason: null,
    state: JSON.parse(JSON.stringify(mockState)),
    events: [
      {
        type: 'water_level_advanced',
        tick: currentTick,
        description: `River height recorded at ${newWater} cm.`,
        caused_by: 'Hydrological Forecast Curve',
        details: { water_level_cm: newWater },
      },
    ],
    narration: {
      text: `Tick ${currentTick}: River waters swelled to ${newWater} cm. Field personnel monitor bund integrity.`,
      source: 'template',
    },
    npc_messages: [],
    guardrail: { status: 'passed', retries: 0 },
    disclaimer: 'Educational simulation – in real emergency call 112.',
  };
}
