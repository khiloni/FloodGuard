import React, { useEffect, useRef, useState } from 'react';
import type { Action, Summary } from '../../api/types';
import { describeAction, npcs } from '../../lib/actions';
import { SourceBadge, type Message } from '../MessageLog';
import { Portrait } from './People';
import { Send, Truck, Mic, Megaphone, BookOpen, Bot } from '../icons';
import { useLang, tr } from '../../lib/i18n';

/** One conversation for the whole story, like a chat app: the narrator, every character and you.
 *  Pick who you are talking to: "Command" gives an order, a character answers your question. */
export const Conversation: React.FC<{
  messages: Message[];
  busy: boolean;
  finished: boolean;
  names: Record<string, string>;
  s: Summary;
  onAsk: (npcId: string, message: string) => void;
  onOrder: (text: string) => void;
  onAdopt: (a: Action, from: string) => void;
  onRequestSupport: () => void;
  onMic?: (to: string) => void;
  listening?: boolean;
  llmOn?: boolean;
}> = ({ messages, busy, finished, names, s, onAsk, onOrder, onAdopt, onRequestSupport, onMic, listening, llmOn }) => {
  const { t } = useLang();
  const roster = npcs();
  const ids = Object.keys(roster);
  const [to, setTo] = useState<string>('command');
  const [text, setText] = useState('');
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [messages.length]);

  const send = () => {
    const v = text.trim();
    if (busy || finished) return;
    if (to === 'command') { if (v) onOrder(v); } else onAsk(to, v);
    setText('');
  };
  const who = to === 'command' ? t('command') : roster[to]?.name;
  const sup = s.support;
  const lastNarration = [...messages].reverse().find((m) => m.kind === 'narration');

  return (
    <section className="conversation" data-testid="people" aria-label={t('conversation')}>
      <div className="convo-head">
        <h2>{t('conversation')}</h2>
        <ul className="npc-list" role="listbox" aria-label={t('talkTo')}>
          <li>
            <button role="option" aria-selected={to === 'command'} className={`npc-row${to === 'command' ? ' on' : ''}`} onClick={() => setTo('command')} data-testid="to-command">
              <span className="cmd-avatar" aria-hidden="true"><Megaphone /></span>
              <span className="npc-who"><strong>{t('command')}</strong><span className="muted small">{t('giveOrders')}</span></span>
            </button>
          </li>
          {ids.map((id) => (
            <li key={id}>
              <button role="option" aria-selected={to === id} className={`npc-row${to === id ? ' on' : ''}`} onClick={() => setTo(id)} data-testid={`npc-${id}`}>
                <Portrait id={id} size={34} />
                <span className="npc-who"><strong>{roster[id].name}</strong><span className="muted small">{roster[id].role}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {llmOn && <p className="ai-note" data-testid="ai-label"><Bot aria-hidden="true" /> {tr('AI-generated text may be wrong. The simulation engine, not the AI, decides outcomes.')}</p>}
      <ol className="convo-lines" ref={list} data-testid="chat-lines">
        {messages.map((m) => {
          if (m.kind === 'system') {
            return <li key={m.id} className="convo-note"><span>{typeof m.tick === 'number' && <b>T{m.tick}</b>} {m.text}</span></li>;
          }
          const mine = m.kind === 'you';
          const npc = m.kind === 'npc' && m.npcId ? roster[m.npcId] : null;
          return (
            <li key={m.id} className={`convo-line ${mine ? 'you' : 'them'} kind-${m.kind}`} data-testid={`msg-${m.kind}`}>
              {!mine && (npc ? <Portrait id={m.npcId!} size={34} /> : <span className="narrator-avatar" aria-hidden="true"><BookOpen /></span>)}
              <div className="convo-bubble">
                <p className="convo-from">
                  {mine ? (m.to && m.to !== 'command' ? `${t('you')} → ${roster[m.to]?.name}` : t('you'))
                    : npc ? `${npc.name} · ${npc.role}` : m.kind === 'reject' ? t('notPossible') : m.kind === 'hint' ? t('tip') : t('narrator')}
                  {typeof m.tick === 'number' && <span className="convo-tick">T{m.tick}</span>}
                </p>
                <p>{m.text}</p>
                {!mine && <SourceBadge source={m.source} />}
                {m.suggestion && (
                  <div className="npc-suggestion" data-testid="npc-suggestion">
                    <p className="small"><strong>{t('suggests')}:</strong> {describeAction(m.suggestion.action, names)}. <span className="muted">{m.suggestion.tradeoff}</span></p>
                    <button className="btn small" disabled={finished} onClick={() => onAdopt(m.suggestion!.action, npc?.name || '')} data-testid="adopt-suggestion">{t('useSuggestion')}</button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {busy && <li className="convo-line them typing" aria-hidden="true"><span className="narrator-avatar"><BookOpen /></span><div className="convo-bubble"><span className="dots3"><i /><i /><i /></span></div></li>}
      </ol>

      {/* Screen readers hear each new narration once. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="live-narration">
        {lastNarration ? `${lastNarration.source === 'llm' ? `${tr('AI narration')}: ` : ''}${lastNarration.text}` : ''}
      </div>

      <form className="convo-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="chat-input">{who}</label>
        <span className="convo-to">{t('to')}: <strong>{who}</strong></span>
        <input id="chat-input" type="text" maxLength={300} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={to === 'command' ? t('orderPlaceholder') : `${t('askPlaceholder')} ${roster[to]?.name}…`} data-testid="chat-input" disabled={finished} />
        {onMic && (
          <button type="button" className={`btn icon mic${listening ? ' listening' : ''}`} onClick={() => onMic(to)} disabled={busy || finished}
            aria-pressed={!!listening} aria-label={t('speakOrder')} title={t('speakOrder')} data-testid="chat-mic"><Mic aria-hidden="true" /></button>
        )}
        <button type="submit" className="btn primary" disabled={busy || finished || (to === 'command' && !text.trim())} data-testid="chat-send">
          <Send aria-hidden="true" /> {to === 'command' ? t('send') : t('ask')} <span className="muted small">({t('oneTurn')})</span>
        </button>
      </form>

      {sup && (
        <div className="support-box" data-testid="support-box">
          <p><Truck aria-hidden="true" /> <strong>{t('outsideSupport')}</strong>{' '}
            {sup.eta_tick !== null ? <span>{t('arrivingAt')} {sup.eta_tick} ({Math.max(0, sup.eta_tick - s.tick)})</span>
              : sup.available ? <span>{sup.boats} 🚤 · {sup.vehicles} 🚚 · {sup.sandbags} {t('sandbags')} · {sup.supply_units} {t('supplies')}</span>
                : <span>{t('alreadyUsed')}</span>}
          </p>
          {sup.available && (
            <button className="btn small" onClick={onRequestSupport} disabled={busy || finished} data-testid="request-support">
              <Send aria-hidden="true" /> {t('request')} ({t('arrivesIn')} {sup.delay_ticks} {t('ticks')})
            </button>
          )}
        </div>
      )}
    </section>
  );
};
