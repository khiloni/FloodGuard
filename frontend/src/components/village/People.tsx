import React, { useState } from 'react';
import { tr } from '../../lib/i18n';
import type { Action, Suggestion, Summary } from '../../api/types';
import { describeAction, npcs } from '../../lib/actions';
import { SourceBadge } from '../MessageLog';
import { Send, Truck, MessagesSquare } from '../icons';

export interface ChatLine { npcId: string; from: 'you' | 'npc'; text: string; source?: string; tick?: number; suggestion?: Suggestion | null }

// Hand-drawn portraits (inline SVG, no stock art); colours by role.
const ROLE_STYLE: Record<string, [string, string, string]> = {
  village_head: ['#56B4E9', '#f7f3ea', '#e0ac69'],
  rescue_worker: ['#E69F00', '#D55E00', '#c68642'],
  family_member: ['#009E73', '#0072B2', '#8d5524'],
  health_worker: ['#CC79A7', '#ffffff', '#d9a066'],
  district_official: ['#F0E442', '#334155', '#b5835a'],
};

export const Portrait: React.FC<{ id: string; size?: number }> = ({ id, size = 44 }) => {
  const [bg, shirt, skin] = ROLE_STYLE[id] || ['#94a3b8', '#e2e8f0', '#d4a373'];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="portrait">
      <circle cx="32" cy="32" r="31" fill={bg} />
      <path d="M12 60c2-12 10-17 20-17s18 5 20 17" fill={shirt} />
      <circle cx="32" cy="27" r="12" fill={skin} />
      {id === 'rescue_worker' && <path d="M18 22c0-10 28-10 28 0z" fill="#F0E442" stroke="#5b3a00" />}
      {id === 'health_worker' && <path d="M20 19h24v5H20z" fill="#ffffff" stroke="#CC79A7" />}
      {id === 'district_official' && <path d="M20 22c1-8 23-9 24 0c-4-2-20-2-24 0z" fill="#1f2937" />}
      {id === 'village_head' && <path d="M19 22c2-9 24-9 26 0c-6-3-20-3-26 0z" fill="#f7f3ea" />}
      {id === 'family_member' && <path d="M20 22c1-8 23-9 24 0c-4-2-9-4-12-2c-3-2-8 0-12 2z" fill="#2b1a0b" />}
      <circle cx="27" cy="27" r="1.6" fill="#1f2937" /><circle cx="37" cy="27" r="1.6" fill="#1f2937" />
      <path d="M27 33c3 2 7 2 10 0" stroke="#1f2937" strokeWidth="1.6" fill="none" />
    </svg>
  );
};

export const People: React.FC<{
  chat: ChatLine[];
  busy: boolean;
  finished: boolean;
  names: Record<string, string>;
  s: Summary;
  onAsk: (npcId: string, message: string) => void;
  onAdopt: (a: Action, from: string) => void;
  onRequestSupport: () => void;
}> = ({ chat, busy, finished, names, s, onAsk, onAdopt, onRequestSupport }) => {
  const roster = npcs();
  const ids = Object.keys(roster);
  const [active, setActive] = useState(ids[0]);
  const [text, setText] = useState('');
  const lines = chat.filter((c) => c.npcId === active);
  const latest = (id: string) => [...chat].reverse().find((c) => c.npcId === id && c.from === 'npc');
  const sup = s.support;
  return (
    <div className="people" data-testid="people">
      <ul className="npc-list" role="listbox" aria-label={tr('People')}>
        {ids.map((id) => (
          <li key={id}>
            <button role="option" aria-selected={active === id} className={`npc-row${active === id ? ' on' : ''}`} onClick={() => setActive(id)} data-testid={`npc-${id}`}>
              <Portrait id={id} size={36} />
              <span className="npc-who"><strong>{roster[id].name}</strong><span className="muted small">{roster[id].role}</span></span>
              {latest(id) && <span className="npc-dot" aria-label={tr('has replied')} />}
            </button>
          </li>
        ))}
      </ul>
      <div className="chat" aria-label={`Conversation with ${roster[active]?.name}`}>
        <ol className="chat-lines" data-testid="chat-lines">
          {lines.length === 0 && <li className="muted small">Ask {roster[active]?.name} for their view. Each conversation uses one turn.</li>}
          {lines.map((c, i) => (
            <li key={i} className={`bubble-line ${c.from}`}>
              <div className="bubble">
                <p>{c.text}</p>
                {c.from === 'npc' && <SourceBadge source={c.source} />}
                {c.suggestion && (
                  <div className="npc-suggestion" data-testid="npc-suggestion">
                    <p className="small"><strong>{tr('Suggests:')}</strong> {describeAction(c.suggestion.action, names)}. <span className="muted">{c.suggestion.tradeoff}</span></p>
                    <button className="btn small" disabled={finished} onClick={() => onAdopt(c.suggestion!.action, roster[active]?.name || active)} data-testid="adopt-suggestion">{tr('Use this suggestion')}</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        <form className="chat-form" onSubmit={(e) => { e.preventDefault(); if (!busy && !finished) { onAsk(active, text.trim()); setText(''); } }}>
          <label className="sr-only" htmlFor="chat-input">Message to {roster[active]?.name}</label>
          <input id="chat-input" type="text" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Ask ${roster[active]?.name}…`} data-testid="chat-input" />
          <button type="submit" className="btn primary small" disabled={busy || finished} data-testid="chat-send"><MessagesSquare aria-hidden="true" /> {tr('Ask')} <span className="muted small">(1 turn)</span></button>
        </form>
      </div>
      {sup && (
        <div className="support-box" data-testid="support-box">
          <p><Truck aria-hidden="true" /> <strong>{tr('Outside support')}</strong>{' '}
            {sup.eta_tick !== null ? <span>arriving at tick {sup.eta_tick} ({Math.max(0, sup.eta_tick - s.tick)} ticks)</span>
              : sup.available ? <span>{sup.boats} boat{sup.boats === 1 ? "" : "s"}, {sup.vehicles} truck{sup.vehicles === 1 ? "" : "s"}, {sup.sandbags} sandbags, {sup.supply_units} supply units</span>
                : <span>{tr('already used')}</span>}
          </p>
          {sup.available && (
            <button className="btn small" onClick={onRequestSupport} disabled={busy || finished} data-testid="request-support">
              <Send aria-hidden="true" /> Request (arrives in {sup.delay_ticks} ticks)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
