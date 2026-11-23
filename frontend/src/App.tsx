import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type TurnInput } from './api/client';
import type {
  Action, EngineState, GameEvent, Layout, Meta, ReplayFrame, Report, Summary, TurnResponse,
} from './api/types';
import { DisclaimerGate, EmergencyFooter, RealEmergencyScreen, WakingUp } from './components/Safety';
import { Header } from './components/Header';
import { Intro } from './components/Intro';
import { VillageScene } from './components/scene/VillageScene';
import { FX_DURATION_MS, type FxItem } from './components/scene/EventEffects';
import { Timeline } from './components/Timeline';
import { ActionPanel } from './components/ActionPanel';
import { CommandBox } from './components/CommandBox';
import { MessageLog, type Message } from './components/MessageLog';
import { NpcPanel } from './components/NpcPanel';
import { StatusPanel } from './components/StatusPanel';
import { ReportScreen } from './components/ReportScreen';
import { useReducedMotion } from './lib/useReducedMotion';
import { describeAction } from './lib/actions';

type Screen = 'boot' | 'gate' | 'play' | 'report';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('boot');
  const [meta, setMeta] = useState<Meta | null>(null);
  const [waking, setWaking] = useState({ active: false, seconds: 0, failed: false });
  const [reduced, setReduced] = useReducedMotion();

  const [sid, setSid] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [fx, setFx] = useState<FxItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [clarify, setClarify] = useState<{ question: string; options: Action[] } | null>(null);
  const [emergency, setEmergency] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [npcLatest, setNpcLatest] = useState<Record<string, { text: string; source: string; tick?: number }>>({});
  const [report, setReport] = useState<Report | null>(null);

  const [frames, setFrames] = useState<ReplayFrame[] | null>(null);
  const [logEvents, setLogEvents] = useState<GameEvent[]>([]);
  const [replayTick, setReplayTick] = useState<number | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false);

  const msgId = useRef(0);
  const fxTimer = useRef<number | undefined>(undefined);
  const addMsg = useCallback((m: Omit<Message, 'id'>) => setMessages((all) => [...all, { ...m, id: ++msgId.current }]), []);

  // ---- Boot: health check with cold-start "waking up" screen ----
  const boot = useCallback(async () => {
    const t0 = Date.now();
    setWaking({ active: false, seconds: 0, failed: false });
    const timer = window.setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      if (s >= 2) setWaking({ active: true, seconds: s, failed: false });
    }, 1000);
    try {
      let ok = false;
      while (!ok && Date.now() - t0 < 120000) {
        try { await api.health(20000); ok = true; } catch { await sleep(2500); }
      }
      if (!ok) throw new Error('unreachable');
      setMeta(await api.meta());
      setWaking({ active: false, seconds: 0, failed: false });
      setScreen('gate');
    } catch {
      setWaking((w) => ({ ...w, active: true, failed: true }));
    } finally {
      window.clearInterval(timer);
    }
  }, []);
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return; // StrictMode runs effects twice in development
    booted.current = true;
    boot();
  }, [boot]);

  // ---- Event animations: one short animation per event, staggered ----
  const playFx = useCallback((evs: GameEvent[], tick: number) => {
    window.clearTimeout(fxTimer.current);
    if (!evs.length) { setFx([]); return; }
    const step = Math.min(350, 3000 / evs.length);
    const items = evs.map((e, i) => ({ key: `${tick}-${i}-${e.type}`, event: e, delay: Math.round(i * step) }));
    setFx(items);
    const total = items[items.length - 1].delay + FX_DURATION_MS + 300;
    fxTimer.current = window.setTimeout(() => setFx([]), total);
  }, []);

  // ---- Session ----
  const startSession = useCallback(async () => {
    setBusy(true);
    try {
      const s = await api.createSession();
      setSid(s.session_id); setLayout(s.layout); setSummary(s.summary); setState(s.state);
      setMessages([]); setEvents([]); setFx([]); setClarify(null); setNpcLatest({}); setReport(null);
      setFrames(null); setReplayTick(null); setReplayPlaying(false);
      addMsg({ kind: 'system', text: 'The river is rising after days of rain. You are in charge of the village response. Give your first order.', tick: 0 });
      setIntroOpen(true);
      setScreen('play');
    } catch (e) {
      addMsg({ kind: 'reject', text: `Could not start a session: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }, [addMsg]);

  const zoneNames = useMemo(() => Object.fromEntries((layout?.zones || []).map((z) => [z.id, z.name])), [layout]);

  const handle = useCallback((res: TurnResponse) => {
    if (res.status === 'real_emergency') {
      setEmergency(res.narration.text);
      setClarify(null);
      return;
    }
    if (res.status === 'clarify') {
      setClarify(res.clarify);
      addMsg({ kind: 'hint', text: res.clarify?.question || 'Please choose one option.' });
      return;
    }
    if (res.status === 'rejected') {
      setClarify(null);
      addMsg({ kind: 'reject', text: res.reject_reason || 'That order cannot be carried out right now.' });
      return;
    }
    setClarify(null);
    if (res.summary) setSummary(res.summary);
    if (res.state) setState(res.state);
    const tick = res.state?.tick ?? 0;
    if (res.parsed_action) addMsg({ kind: 'system', text: `Order: ${describeAction(res.parsed_action, zoneNames)}`, tick });
    addMsg({ kind: 'narration', text: res.narration.text, source: res.narration.source, tick,
      cards: (res.cited_rulecards || []).map((c) => ({ id: c.id, title: c.title })) });
    for (const m of res.npc_messages || []) {
      addMsg({ kind: 'npc', text: m.text, source: m.source, npcId: m.npc_id, tick });
      setNpcLatest((all) => ({ ...all, [m.npc_id]: { text: m.text, source: m.source, tick } }));
    }
    setEvents((all) => [...all, ...res.events]);
    playFx(res.events, tick);
  }, [addMsg, playFx, zoneNames]);

  const submit = useCallback(async (input: TurnInput) => {
    if (!sid || busy || state?.is_finished) return;
    setReplayTick(null); setReplayPlaying(false);
    setBusy(true);
    try {
      handle(await api.turn(sid, input));
    } catch (e) {
      addMsg({ kind: 'reject', text: `The server did not respond: ${(e as Error).message}. Please try again.` });
    } finally {
      setBusy(false);
    }
  }, [sid, busy, state, handle, addMsg]);

  // ---- Replay (frames are computed by the server from /log) ----
  const enterReplay = useCallback(async () => {
    if (!sid) return;
    try {
      const log = await api.log(sid, true);
      setFrames(log.frames || []);
      setLogEvents(log.events || []);
      setReplayTick(0);
      setReplayPlaying(true);
    } catch (e) {
      addMsg({ kind: 'reject', text: `Replay is not available: ${(e as Error).message}` });
    }
  }, [sid, addMsg]);

  const scrub = useCallback((t: number) => {
    if (replayTick !== null && t === replayTick + 1) playFx(logEvents.filter((e) => e.tick === t), t);
    setReplayTick(t);
  }, [replayTick, logEvents, playFx]);

  useEffect(() => {
    if (!replayPlaying || replayTick === null || !frames) return;
    const last = frames[frames.length - 1]?.tick ?? 0;
    if (replayTick >= last) { setReplayPlaying(false); return; }
    const id = window.setTimeout(() => scrub(replayTick + 1), reduced ? 700 : 1100);
    return () => window.clearTimeout(id);
  }, [replayPlaying, replayTick, frames, scrub, reduced]);

  const exitReplay = () => { setReplayTick(null); setReplayPlaying(false); setFx([]); };

  const openReport = useCallback(async () => {
    if (!sid) return;
    try {
      setReport(await api.report(sid));
      setScreen('report');
    } catch (e) {
      addMsg({ kind: 'reject', text: `Could not load the report: ${(e as Error).message}` });
    }
  }, [sid, addMsg]);

  // ---- Render ----
  const frameSummary = replayTick !== null && frames ? frames.find((f) => f.tick === replayTick)?.summary : null;
  const shown = frameSummary || summary;
  const forecast = state?.forecast_cm || [];
  const peakTick = forecast.length ? forecast.indexOf(Math.max(...forecast)) + 1 : null;
  const finished = !!state?.is_finished;
  const phase = shown?.phase ?? 'before';
  const examples = (meta?.example_commands_by_phase?.[summary?.phase ?? 'before']) || meta?.example_commands || [];

  return (
    <div className={`app${reduced ? ' reduced' : ''}`}>
      <a className="skip-link" href="#main">Skip to the village</a>
      <Header meta={meta} phase={screen === 'play' ? phase : undefined} tick={shown?.tick} maxTicks={shown?.max_ticks}
        reduced={reduced} onToggleReduced={setReduced} />

      {screen === 'boot' && waking.active && <WakingUp seconds={waking.seconds} failed={waking.failed} onRetry={boot} />}
      {screen === 'boot' && !waking.active && <div className="boot" role="status">Loading…</div>}
      {screen === 'gate' && <DisclaimerGate serverDisclaimer={meta?.disclaimer} onAcknowledge={startSession} />}

      {screen === 'play' && layout && shown && (
        <main id="main" className="play">
          <div className="stage">
            <VillageScene layout={layout} summary={shown} state={state} fx={fx} reduced={reduced} replaying={replayTick !== null} />
            {introOpen && <Intro onDone={() => setIntroOpen(false)} />}
            {finished && replayTick === null && !introOpen && (
              <div className="story-complete" role="status" data-testid="story-complete">
                <p><strong>The story is complete.</strong> See what your choices led to.</p>
                <button className="btn primary" onClick={openReport} data-testid="open-report">See what happened</button>
              </div>
            )}
            {busy && <div className="busy" role="status" aria-live="polite">The village responds…</div>}
          </div>

          <Timeline maxTicks={summary?.max_ticks ?? 30} currentTick={summary?.tick ?? 0}
            floodStart={summary?.flood_start_tick ?? null} recoveryStart={summary?.recovery_start_tick ?? null}
            peakTick={peakTick} events={events} replayTick={replayTick} replayPlaying={replayPlaying} replayAvailable={!!sid}
            onEnterReplay={enterReplay} onScrub={(t) => { setReplayPlaying(false); scrub(t); }}
            onTogglePlay={() => setReplayPlaying((p) => !p)} onExitReplay={exitReplay} />

          <div className="console">
            <div className="col-story">
              <CommandBox examples={finished ? [] : examples} busy={busy || finished} clarify={clarify} zoneNames={zoneNames}
                onText={(t) => submit({ type: 'text', text: t })} onOption={(a) => submit({ type: 'button', action: a })} />
              <MessageLog messages={messages} llmOn={meta?.llm_mode === 'openai_compat'} />
            </div>
            <div className="col-actions">
              <ActionPanel layout={layout} phase={summary?.phase ?? 'before'} busy={busy || finished}
                onSubmit={(a) => submit({ type: 'button', action: a })} onHint={(t) => addMsg({ kind: 'hint', text: t })} />
            </div>
            <div className="col-status">
              <StatusPanel s={shown} state={state} />
              <NpcPanel latest={npcLatest} busy={busy || finished}
                onTalk={(id) => submit({ type: 'button', action: { name: 'consult_npc', params: { npc_id: id } } })} />
            </div>
          </div>
        </main>
      )}

      {screen === 'report' && report && (
        <ReportScreen report={report}
          onReplay={() => { setScreen('play'); enterReplay(); }}
          onRestart={() => startSession()} />
      )}

      {emergency && <RealEmergencyScreen message={emergency} onReturn={() => setEmergency(null)} />}
      <EmergencyFooter />
    </div>
  );
};
