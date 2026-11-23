import React, { useEffect, useRef } from 'react';
import { npcs } from '../lib/actions';
import { Bot, FileText, Shield, Info } from './icons';

export interface Message {
  id: number;
  kind: 'narration' | 'npc' | 'system' | 'reject' | 'hint';
  text: string;
  source?: string;
  tick?: number;
  npcId?: string;
  cards?: { id: string; title: string }[];
}

export const SourceBadge: React.FC<{ source?: string }> = ({ source }) => {
  if (source === 'llm') {
    return <span className="badge badge-ai" data-testid="source-llm" title="Written by an open-source language model and checked by guardrails"><Bot aria-hidden="true" />AI · may be wrong</span>;
  }
  if (source === 'emergency_override') {
    return <span className="badge badge-safety"><Shield aria-hidden="true" />Safety notice</span>;
  }
  if (source === 'template') {
    return <span className="badge badge-template" data-testid="source-template" title="Fixed template text"><FileText aria-hidden="true" />Template</span>;
  }
  return null;
};

export const MessageLog: React.FC<{ messages: Message[]; llmOn: boolean }> = ({ messages, llmOn }) => {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // Keep the newest message in view inside the list only (never scroll the page).
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length]);
  const lastNarration = [...messages].reverse().find((m) => m.kind === 'narration');
  return (
    <section className="messages" aria-label="What is happening">
      <h2 className="panel-title">What is happening</h2>
      {llmOn && <p className="ai-note" data-testid="ai-label"><Bot aria-hidden="true" /> AI-generated text may be wrong. The simulation engine, not the AI, decides outcomes.</p>}
      <ol className="message-list" data-testid="message-list" ref={list}>
        {messages.map((m) => (
          <li key={m.id} className={`msg msg-${m.kind}`} data-testid={`msg-${m.kind}`}>
            <div className="msg-head">
              {typeof m.tick === 'number' && <span className="msg-tick">Tick {m.tick}</span>}
              {m.kind === 'npc' && m.npcId && <strong>{npcs()[m.npcId]?.name || m.npcId}</strong>}
              {(m.kind === 'reject' || m.kind === 'hint') && <Info aria-hidden="true" />}
              <SourceBadge source={m.source} />
            </div>
            <p>{m.text}</p>
            {m.cards && m.cards.length > 0 && (
              <p className="msg-cards">Learn more: {m.cards.map((c) => <span key={c.id} className="card-ref">{c.id} {c.title}</span>)}</p>
            )}
          </li>
        ))}
      </ol>
      {/* Screen readers hear each new narration once. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="live-narration">
        {lastNarration ? `${lastNarration.source === 'llm' ? 'AI narration: ' : ''}${lastNarration.text}` : ''}
      </div>
    </section>
  );
};
