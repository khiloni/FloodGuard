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
import help from './fixtures/help.json';
import helpRecovery from './fixtures/help_recovery.json';
import npc from './fixtures/npc.json';
import urban from './fixtures/packs/urban-flash-flood-01.json';
import dam from './fixtures/packs/dam-release-01.json';
import cyclone from './fixtures/packs/cyclone-surge-01.json';
import island from './fixtures/packs/river-island-01.json';
import glacial from './fixtures/packs/glacial-lake-01.json';

const PACKS: Record<string, { session: any; script: any[] }> = {
  'urban-flash-flood-01': urban as any,
  'dam-release-01': dam as any,
  'cyclone-surge-01': cyclone as any,
  'river-island-01': island as any,
  'glacial-lake-01': glacial as any,
};
let pack: string = 'village-river-01';
const currentScript = (): any[] => (PACKS[pack]?.script || (script as any[]));

// Test switches via the page URL: ?mock=slow | allEvents | end | llm | llmdown
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
  const out: any = { ...res, source: 'llm', llm_mode: 'openai_compat' };
  if (res.narration) out.narration = { ...res.narration, source: 'llm' };
  if (Array.isArray(res.npc_messages)) out.npc_messages = res.npc_messages.map((m: any) => ({ ...m, source: 'llm' }));
  if (Array.isArray(res.options)) out.source = 'llm';
  return out;
}
const llmMeta = (m: any) => (mode === 'llm' ? { ...m, llm_mode: 'openai_compat', llm_status: 'online' }
  : mode === 'llmdown' ? { ...m, llm_mode: 'openai_compat', llm_status: 'offline' } : m);

function nextTurn() {
  const steps = currentScript();
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
    return HttpResponse.json(llmMeta(health));
  }),
  http.get('/api/v1/meta', () => HttpResponse.json(llmMeta(meta))),
  http.get('/api/v1/scenarios', () => HttpResponse.json(scenarios)),
  http.post('/api/v1/sessions', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { scenario_id?: string; seed?: number };
    pack = body.scenario_id || 'village-river-01';
    turn = mode === 'end' ? currentScript().length - 1 : 0;
    const base = PACKS[pack]?.session || session;
    return HttpResponse.json(body.seed !== undefined ? { ...base, seed: body.seed } : base);
  }),
  http.post('/api/v1/sessions/:sid/help', async () => {
    await delay(120);
    const recovery = mode === 'end';
    return HttpResponse.json(withLlm(recovery ? helpRecovery : help));
  }),
  http.post('/api/v1/sessions/:sid/turns', async ({ request }) => {
    const body = (await request.json()) as { input: any };
    const input = body.input || {};
    await delay(150);
    if (input.type === 'text') {
      const text = String(input.text || '');
      if (EMERGENCY_RE.test(text)) return HttpResponse.json(emergency);
      if (/restore power/i.test(text) && turn < 17) return HttpResponse.json(rejected);
      if (pack === 'village-river-01' && !KNOWN_TEXT.has(text.toLowerCase())) return HttpResponse.json(clarify);
    }
    return HttpResponse.json(withLlm(nextTurn()));
  }),
  http.post('/api/v1/sessions/:sid/npc/:npc/messages', async () => {
    await delay(120);
    turn += 1;
    return HttpResponse.json(withLlm(npc));
  }),
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
