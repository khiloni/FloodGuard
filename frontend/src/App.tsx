import React, { useState, useEffect } from 'react';
import { State, TurnResponse, TurnEvent, RuleCard, ScoreBreakdown } from './types/api';
import { fetchMeta, createSession, submitTurn, fetchReport } from './api/client';
import { DisclaimerGate } from './components/DisclaimerGate';
import { SetupScreen } from './components/SetupScreen';
import { Dashboard } from './components/Dashboard';
import { ReportScreen } from './components/ReportScreen';
import { EmergencyFooter } from './components/EmergencyFooter';
import './styles.css';

export const App: React.FC = () => {
  const [screen, setScreen] = useState<'gate' | 'setup' | 'play' | 'report'>('gate');
  const [meta, setMeta] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [gameState, setGameState] = useState<State | null>(null);
  const [events, setEvents] = useState<TurnEvent[]>([]);
  const [narration, setNarration] = useState<string>('Incident initiated. River levels monitored.');
  const [npcDialogue, setNpcDialogue] = useState<Array<{ npc_id: string; text: string; source: string }>>([]);
  const [clarify, setClarify] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [realEmergency, setRealEmergency] = useState(false);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [reviewedCards, setReviewedCards] = useState<RuleCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [coldStartNotice, setColdStartNotice] = useState(false);

  useEffect(() => {
    fetchMeta().then((m) => setMeta(m));
  }, []);

  const handleStartSession = async (scenarioId: string, difficulty: string, language: string) => {
    setIsLoading(true);
    const timer = setTimeout(() => setColdStartNotice(true), 3000);

    try {
      const data = await createSession(scenarioId);
      clearTimeout(timer);
      setColdStartNotice(false);
      setSessionId(data.session_id);
      setGameState(data.state);
      setScreen('play');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setColdStartNotice(false);
    }
  };

  const handleTakeAction = async (inputPayload: any) => {
    if (!sessionId || isLoading) return;
    setIsLoading(true);
    setRejectReason(null);
    setClarify(null);

    try {
      const res: TurnResponse = await submitTurn(sessionId, inputPayload);
      if (res.status === 'real_emergency') {
        setRealEmergency(true);
        setNarration(res.narration.text);
        return;
      }

      if (res.status === 'clarify') {
        setClarify(res.clarify);
        return;
      }

      if (res.status === 'rejected') {
        setRejectReason(res.reject_reason);
        return;
      }

      // Success 'ok' turn
      setGameState(res.state);
      setEvents(res.events || []);
      setNarration(res.narration.text);
      if (res.npc_messages && res.npc_messages.length > 0) {
        setNpcDialogue(res.npc_messages);
      }
      if (res.cited_rulecards) {
        setReviewedCards((prev) => {
          const ids = new Set(prev.map((c) => c.id));
          const newOnes = res.cited_rulecards!.filter((c) => !ids.has(c.id));
          return [...prev, ...newOnes];
        });
      }

      if (res.state.is_finished && res.state.score) {
        setScore(res.state.score);
        setScreen('report');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const rep = await fetchReport(sessionId);
      if (rep && rep.score) {
        setScore(rep.score);
      }
      setScreen('report');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAgain = () => {
    setSessionId('');
    setGameState(null);
    setEvents([]);
    setClarify(null);
    setRejectReason(null);
    setRealEmergency(false);
    setScore(null);
    setScreen('setup');
  };

  return (
    <div className="app-root">
      {/* Service Wake-up Banner */}
      {coldStartNotice && (
        <div className="cold-start-banner" role="status">
          ⏳ Waking up simulation service... please hold on a few seconds.
        </div>
      )}

      {/* Screen Router */}
      <main className="main-content" role="main">
        {screen === 'gate' && (
          <DisclaimerGate
            onAcknowledge={() => setScreen('setup')}
            disclaimerText={meta?.disclaimer || ''}
          />
        )}

        {screen === 'setup' && (
          <SetupScreen onStart={handleStartSession} isLoading={isLoading} />
        )}

        {screen === 'play' && gameState && (
          <Dashboard
            state={gameState}
            events={events}
            narration={narration}
            npcDialogue={npcDialogue}
            clarify={clarify}
            rejectReason={rejectReason}
            realEmergency={realEmergency}
            isLoading={isLoading}
            onTakeAction={handleTakeAction}
            onEndSession={handleEndSession}
          />
        )}

        {screen === 'report' && score && gameState && (
          <ReportScreen
            score={score}
            state={gameState}
            events={events}
            citedCards={reviewedCards}
            onPlayAgain={handlePlayAgain}
          />
        )}
      </main>

      {/* Persistent Emergency Footer on every screen */}
      <EmergencyFooter />
    </div>
  );
};

export default App;
