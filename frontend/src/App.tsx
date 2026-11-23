import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type TurnInput } from './api/client';
import type {
  Action, EngineState, GameEvent, HelpResponse, Layout, Meta, ReplayFrame, Report, ScenarioInfo, Summary, TurnResponse,
} from './api/types';
import { DisclaimerGate, EmergencyFooter, RealEmergencyScreen, WakingUp } from './components/Safety';
import { Header } from './components/Header';
import { Intro } from './components/Intro';
import { VillageScene } from './components/scene/VillageScene';
import { FX_DURATION_MS, type FxItem } from './components/scene/EventEffects';
import { Timeline } from './components/Timeline';
import { ActionPanel } from './components/ActionPanel';
import { CommandBox } from './components/CommandBox';
import { type Message, SourceBadge } from './components/MessageLog';
import { ReportScreen } from './components/ReportScreen';
import { ScenarioSelect, type StartOptions } from './components/ScenarioSelect';
import { Pager } from './components/Pager';
import { Hud } from './components/Hud';
import { HelpPanel, PendingOrder } from './components/HelpPanel';
import { StatusBoard } from './components/village/StatusBoard';
import { Briefing, Logs } from './components/village/Briefing';
import { People, type ChatLine } from './components/village/People';
import { Lightbulb, Map as MapIcon, Landmark } from './components/icons';
import { useReducedMotion } from './lib/useReducedMotion';
import { describeAction, setActiveNpcs } from './lib/actions';

type Screen = 'boot' | 'gate' | 'select' | 'play' | 'report';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('boot');
  const [meta, setMeta] = useState<Meta | null>(null);
  const [waking, setWaking] = useState({ active: false, seconds: 0, failed: false });
  const [reduced, setReduced] = useReducedMotion();

  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [scenario, setScenario] = useState<ScenarioInfo | null>(null);
  const [opts, setOpts] = useState<StartOptions | null>(null);
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
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [page, setPage] = useState(0);
  const [help, setHelp] = useState<HelpResponse | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);
  const [pending, setPending] = useState<{ action: Action; from?: string } | null>(null);

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
      const [m, sc] = await Promise.all([api.meta(), api.scenarios()]);
      setMeta(m);
      setScenarios(sc.scenarios);
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

  // ---- Event animations: one short animation per engine event, staggered ----
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
  const startSession = useCallback(async (o: StartOptions & { seed?: number }) => {
    setBusy(true);
    try {
      const s = await api.createSession(o);
      const info = scenarios.find((x) => x.id === o.scenario_id) || null;
      setActiveNpcs(info?.npcs || []);
      setScenario(info); setOpts(o);
      setSid(s.session_id); setLayout(s.layout); setSummary(s.summary); setState(s.state);
      setMessages([]); setEvents([]); setFx([]); setClarify(null); setChat([]); setReport(null);
      setHelp(null); setHelpOpen(false); setPending(null); setPage(0);
      setFrames(null); setReplayTick(null); setReplayPlaying(false);
      addMsg({ kind: 'system', text: info?.hook || 'You are in charge of the response. Give your first order.', tick: 0 });
      setIntroOpen(true);
      setScreen('play');
    } catch (e) {
      addMsg({ kind: 'reject', text: `Could not start a session: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }, [addMsg, scenarios]);

  const names = useMemo(() => Object.fromEntries([
    ...(layout?.zones || []).map((z) => [z.id, z.name]),
    ...(layout?.shelters || []).map((sh) => [sh.id, sh.name]),
  ]), [layout]);

  const handle = useCallback((res: TurnResponse, chatNpc?: string) => {
    if (res.status === 'real_emergency') {
      setEmergency(res.narration.text);
      setClarify(null);
      return;
    }
    if (res.status === 'clarify') {
      setClarify(res.clarify);
      setPage(0);
      addMsg({ kind: 'hint', text: res.clarify?.question || 'Please choose one option.' });
      return;
    }
    if (res.status === 'rejected') {
      setClarify(null);
      addMsg({ kind: 'reject', text: res.reject_reason || 'That order cannot be carried out right now.' });
      return;
    }
    setClarify(null);
    setHelp(null);
    if (res.summary) setSummary(res.summary);
    if (res.state) setState(res.state);
    const tick = res.state?.tick ?? 0;
    if (res.parsed_action) addMsg({ kind: 'system', text: `Order: ${describeAction(res.parsed_action, names)}`, tick });
    addMsg({ kind: 'narration', text: res.narration.text, source: res.narration.source, tick,
      cards: (res.cited_rulecards || []).map((c) => ({ id: c.id, title: c.title })) });
    for (const m of res.npc_messages || []) {
      addMsg({ kind: 'npc', text: m.text, source: m.source, npcId: m.npc_id, tick });
      setChat((all) => [...all, { npcId: m.npc_id, from: 'npc', text: m.text, source: m.source, tick, suggestion: m.suggestion || null }]);
    }
    if (chatNpc && !(res.npc_messages || []).length) {
      setChat((all) => [...all, { npcId: chatNpc, from: 'npc', text: res.narration.text, source: res.narration.source, tick }]);
    }
    setEvents((all) => [...all, ...res.events]);
    playFx(res.events, tick);
  }, [addMsg, playFx, names]);

  const canAct = !!sid && !busy && !state?.is_finished;

  const submit = useCallback(async (input: TurnInput) => {
    if (!canAct || !sid) return;
    setReplayTick(null); setReplayPlaying(false); setPending(null);
    setBusy(true);
    try {
      handle(await api.turn(sid, input));
    } catch (e) {
      addMsg({ kind: 'reject', text: `The server did not respond: ${(e as Error).message}. Please try again.` });
    } finally {
      setBusy(false);
    }
  }, [canAct, sid, handle, addMsg]);

  const askNpc = useCallback(async (npcId: string, message: string) => {
    if (!canAct || !sid) return;
    const text = message || 'What should we do now?';
    setChat((all) => [...all, { npcId, from: 'you', text }]);
    setBusy(true);
    try {
      handle(await api.npc(sid, npcId, text), npcId);
    } catch (e) {
      addMsg({ kind: 'reject', text: `The server did not respond: ${(e as Error).message}.` });
    } finally {
      setBusy(false);
    }
  }, [canAct, sid, handle, addMsg]);

  const askHelp = useCallback(async () => {
    if (!sid) return;
    setHelpOpen(true); setHelpLoading(true);
    try {
      setHelp(await api.help(sid));
    } catch (e) {
      addMsg({ kind: 'reject', text: `Suggestions are not available: ${(e as Error).message}` });
      setHelpOpen(false);
    } finally {
      setHelpLoading(false);
    }
  }, [sid, addMsg]);

  // ---- Replay (frames are computed by the server from /log) ----
  const enterReplay = useCallback(async () => {
    if (!sid) return;
    try {
      const log = await api.log(sid, true);
      setFrames(log.frames || []);
      setLogEvents(log.events || []);
      setReplayTick(0);
      setReplayPlaying(true);
      setPage(0);
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
  const metaExamples = (meta?.example_commands_by_phase?.[summary?.phase ?? 'before']) || meta?.example_commands || [];
  const examples = useMemo(() => {
    if (!layout || !scenario || scenario.id === 'village-river-01') return metaExamples;
    const z = layout.zones.map((x) => x.name.replace(/ \(.*\)/, ''));
    const p = summary?.phase ?? 'before';
    if (p === 'before') return ['warn everyone', `open the ${layout.shelters[0]?.name ?? 'shelter'}`, `evacuate ${z[0]}`];
    if (p === 'flood') return [`send 2 boats to ${z[0]}`, `evacuate ${z[1] ?? z[0]}`, 'wait'];
    return metaExamples;
  }, [layout, scenario, summary?.phase, metaExamples]);
  const minutes = scenario?.tick_duration_minutes ?? 30;
  const llmOn = meta?.llm_mode === 'openai_compat';
  const lastNarration = [...messages].reverse().find((m) => m.kind === 'narration' || m.kind === 'reject' || m.kind === 'hint' || m.kind === 'system');

  const actPage = layout && shown && (
    <div className="act">
      <div className="stage" data-noswipe>
        <VillageScene layout={layout} summary={shown} state={state} fx={fx} reduced={reduced} replaying={replayTick !== null} />
        <p className="model-label">Stylized teaching model, not a flood forecast</p>
        {finished && replayTick === null && !introOpen && (
          <div className="story-complete" role="status" data-testid="story-complete">
            <p><strong>The story is complete.</strong></p>
            <button className="btn primary small" onClick={openReport} data-testid="open-report">See what happened</button>
          </div>
        )}
        {busy && <div className="busy" role="status" aria-live="polite">Responding…</div>}
      </div>
      {lastNarration && (
        <p className={`caption msg-${lastNarration.kind}`} data-testid="caption" aria-live="polite">
          {typeof lastNarration.tick === 'number' && <span className="msg-tick">T{lastNarration.tick}</span>} {lastNarration.text} <SourceBadge source={lastNarration.source} />
        </p>
      )}
      <div className="orders">
        <div className="orders-scroll">
          {pending && (
            <PendingOrder action={pending.action} names={names} busy={!canAct} from={pending.from}
              onCancel={() => setPending(null)} onConfirm={() => submit({ type: 'button', action: pending.action })} />
          )}
          {helpOpen && (
            <HelpPanel help={help} loading={helpLoading} names={names}
              onUse={(a) => { setPending({ action: a }); setHelpOpen(false); }} onClose={() => setHelpOpen(false)} />
          )}
          <div className="orders-top">
            <button className="btn help-btn" onClick={askHelp} disabled={!sid || finished || helpLoading} data-testid="help-button">
              <Lightbulb aria-hidden="true" /> What should I do?
            </button>
          </div>
          <ActionPanel layout={layout} phase={summary?.phase ?? 'before'} busy={!canAct} mechanic={scenario?.mechanic_type}
            onSubmit={(a) => submit({ type: 'button', action: a })} onHint={(t) => addMsg({ kind: 'hint', text: t })} />
          <CommandBox examples={finished ? [] : examples.slice(0, 3)} busy={!canAct} clarify={clarify} zoneNames={names}
            onText={(t) => submit({ type: 'text', text: t })} onOption={(a) => submit({ type: 'button', action: a })} />
        </div>
        <Timeline maxTicks={summary?.max_ticks ?? 30} currentTick={summary?.tick ?? 0} minutesPerTick={minutes}
          floodStart={summary?.flood_start_tick ?? null} recoveryStart={summary?.recovery_start_tick ?? null}
          peakTick={peakTick} events={events} replayTick={replayTick} replayPlaying={replayPlaying} replayAvailable={!!sid}
          onEnterReplay={enterReplay} onScrub={(t) => { setReplayPlaying(false); scrub(t); }}
          onTogglePlay={() => setReplayPlaying((p) => !p)} onExitReplay={exitReplay} />
      </div>
    </div>
  );

  const villagePage = layout && shown && (
    <div className="village">
      <div className="village-col">
        <Briefing scenario={scenario} s={shown} />
        <StatusBoard s={shown} state={state} layout={layout} />
      </div>
      <div className="village-col">
        <People chat={chat} busy={!canAct} finished={finished} names={names} s={shown}
          onAsk={askNpc}
          onAdopt={(a, from) => { setPending({ action: a, from }); setPage(0); }}
          onRequestSupport={() => submit({ type: 'button', action: { name: 'request_external_support', params: {} } })} />
        <Logs messages={messages} events={events} llmOn={llmOn} />
      </div>
    </div>
  );

  return (
    <div className={`app screen-${screen}${reduced ? ' reduced' : ''}`}>
      <a className="skip-link" href="#main">Skip to the main content</a>
      <Header meta={meta} phase={screen === 'play' ? phase : undefined} tick={shown?.tick} maxTicks={shown?.max_ticks}
        scenarioName={screen === 'play' ? scenario?.name : undefined}
        onHome={screen === 'play' || screen === 'report' ? () => setScreen('select') : undefined}
        reduced={reduced} onToggleReduced={setReduced} />

      {screen === 'boot' && waking.active && <WakingUp seconds={waking.seconds} failed={waking.failed} onRetry={boot} />}
      {screen === 'boot' && !waking.active && <div className="boot" role="status">Loading…</div>}
      {screen === 'gate' && <DisclaimerGate serverDisclaimer={meta?.disclaimer} onAcknowledge={() => setScreen('select')} />}
      {screen === 'select' && <ScenarioSelect scenarios={scenarios} busy={busy} onStart={startSession} />}

      {screen === 'play' && layout && shown && (
        <main id="main" className="play">
          <Hud s={shown} minutesPerTick={minutes} />
          <Pager index={page} onIndex={setPage} reduced={reduced} pages={[
            { id: 'act', label: 'Act', icon: <MapIcon aria-hidden="true" />, content: actPage },
            { id: 'village', label: 'Village', icon: <Landmark aria-hidden="true" />, content: villagePage },
          ]} />
          {introOpen && <Intro scenario={scenario} onDone={() => setIntroOpen(false)} />}
        </main>
      )}

      {screen === 'report' && report && (
        <ReportScreen report={report}
          onReplay={() => { setScreen('play'); enterReplay(); }}
          onRetry={() => opts && startSession({ ...opts, seed: report.seed })}
          onRestart={() => setScreen('select')} />
      )}

      {emergency && <RealEmergencyScreen message={emergency} onReturn={() => setEmergency(null)} />}
      <EmergencyFooter />
    </div>
  );
};
