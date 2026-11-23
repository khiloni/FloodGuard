// Mock API for `npm run dev:mock` and Playwright only (never bundled into dist).
// Every response is a real API response recorded by backend/scripts/record_fixtures.py;
// the mock just replays them in order, it does not simulate anything.
import { http, HttpResponse, delay } from 'msw';
import health from './fixtures/health.json';
import meta from './fixtures/meta.json';
import scenarios from './fixtures/scenarios.json';
import session from './fixtures/session.json';
import script from './fixtures/script.json';
import log from './fixtures/log.json';
import report from './fixtures/report.json';
import clarify from './fixtures/clarify.json';
import rejected from './fixtures/rejected.json';
import emergency from './fixtures/emergency.json';
import allEvents from './fixtures/all_events.json';

// Test switches via the page URL: ?mock=slow | allEvents | end | llm
const mode = new URLSearchParams(window.location.search).get('mock') || '';
let turn = 0;
const started = Date.now();

const EMERGENCY_RE = /real emergency|actually trapped|\b112\b|\b1078\b|not a game/i;
const KNOWN_TEXT = new Set([
  ...(script as any[]).filter((s) => s.input.type === 'text').map((s) => s.input.text.toLowerCase()),
  ...Object.values((meta as any).example_commands_by_phase || {}).flat().map((t: any) => String(t).toLowerCase()),
]);

function withLlm<T extends Record<string, any>>(res: T): T {
  if (mode !== 'llm') return res;
  return { ...res, source: 'llm', llm_mode: 'openai_compat', narration: { ...res.narration, source: 'llm' } };
}

function nextTurn() {
  const steps = script as any[];
  if (mode === 'allEvents' && turn === 0) {
    turn = 1;
    return allEvents;
  }
  const res = steps[Math.min(turn, steps.length - 1)].response;
  turn += 1;
  return res;
}

export const handlers = [
  http.get('/api/v1/health', async () => {
    const left = 4000 - (Date.now() - started);
    if (mode === 'slow' && left > 0) await delay(left);
    return HttpResponse.json(mode === 'llm' ? { ...health, llm_mode: 'openai_compat', llm_status: 'online' } : health);
  }),
  http.get('/api/v1/meta', () => HttpResponse.json(mode === 'llm' ? { ...meta, llm_mode: 'openai_compat', llm_status: 'online' } : meta)),
  http.get('/api/v1/scenarios', () => HttpResponse.json(scenarios)),
  http.post('/api/v1/sessions', () => {
    turn = mode === 'end' ? (script as any[]).length - 1 : 0;
    return HttpResponse.json(session);
  }),
  http.post('/api/v1/sessions/:sid/turns', async ({ request }) => {
    const body = (await request.json()) as { input: any };
    const input = body.input || {};
    await delay(150);
    if (input.type === 'text') {
      const text = String(input.text || '');
      if (EMERGENCY_RE.test(text)) return HttpResponse.json(emergency);
      if (/restore power/i.test(text) && turn < 17) return HttpResponse.json(rejected);
      if (!KNOWN_TEXT.has(text.toLowerCase())) return HttpResponse.json(clarify);
    }
    return HttpResponse.json(withLlm(nextTurn()));
  }),
  http.post('/api/v1/sessions/:sid/npc/:npc', () => HttpResponse.json(withLlm(nextTurn()))),
  http.get('/api/v1/sessions/:sid/log', () => {
    const upto = Math.min(turn, (log as any).frames.length - 1);
    return HttpResponse.json({
      ...log,
      actions: (log as any).actions.slice(0, upto),
      events: (log as any).events.filter((e: any) => e.tick <= upto),
      frames: (log as any).frames.slice(0, upto + 1),
    });
  }),
  http.get('/api/v1/sessions/:sid/report', () => HttpResponse.json(report)),
  http.post('/api/v1/sessions/:sid/end', () => HttpResponse.json({ status: 'ended', score: (report as any).score })),
];
