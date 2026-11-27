import type {
  Action, Health, HelpResponse, Meta, Report, ScenarioInfo, SessionCreated, SessionLog, TurnResponse,
} from './types';

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public status: number, public detail?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 60000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api/v1${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let detail: any;
      try { detail = await res.json(); } catch { /* not json */ }
      const msg = detail?.detail?.message || detail?.detail || res.statusText || 'Request failed';
      throw new ApiError(typeof msg === 'string' ? msg : 'Request failed', res.status, detail);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export type TurnInput = { type: 'button'; action: Action } | { type: 'text'; text: string };

export const api = {
  health: (timeoutMs?: number) => request<Health>('/health', undefined, timeoutMs),
  meta: () => request<Meta>('/meta'),
  scenarios: () => request<{ scenarios: ScenarioInfo[] }>('/scenarios'),
  createSession: (opts: { scenario_id: string; seed?: number; difficulty?: string; language?: string }) =>
    post<SessionCreated>('/sessions', opts),
  help: (sid: string) => post<HelpResponse>(`/sessions/${sid}/help`, {}),
  turn: (sid: string, input: TurnInput) => post<TurnResponse>(`/sessions/${sid}/turns`, { input }),
  npc: (sid: string, npcId: string, message: string) => post<TurnResponse>(`/sessions/${sid}/npc/${npcId}/messages`, { message }),
  log: (sid: string, frames = false) => request<SessionLog>(`/sessions/${sid}/log${frames ? '?frames=true' : ''}`),
  report: (sid: string) => request<Report>(`/sessions/${sid}/report`),
  end: (sid: string) => post<{ status: string }>(`/sessions/${sid}/end`, {}),
  preview: (sid: string, action: Action, horizon = 4) => post<any>(`/sessions/${sid}/preview`, { action, horizon }),
};
