import React from 'react';
import { NPCS } from '../lib/actions';
import { SourceBadge } from './MessageLog';

// Hand-drawn portraits (inline SVG, no stock art).
const Portrait: React.FC<{ id: string }> = ({ id }) => {
  const skin = id === 'rescue_worker' ? '#c68642' : id === 'family_member' ? '#8d5524' : '#e0ac69';
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" className="portrait">
      <circle cx="32" cy="32" r="31" fill={id === 'village_head' ? '#56B4E9' : id === 'rescue_worker' ? '#E69F00' : '#009E73'} />
      <path d="M12 60c2-12 10-17 20-17s18 5 20 17" fill={id === 'village_head' ? '#f7f3ea' : id === 'rescue_worker' ? '#D55E00' : '#0072B2'} />
      <circle cx="32" cy="27" r="12" fill={skin} />
      {id === 'village_head' && <path d="M19 22c2-9 24-9 26 0c-6-3-20-3-26 0z" fill="#f7f3ea" />}
      {id === 'rescue_worker' && <path d="M18 22c0-10 28-10 28 0z" fill="#F0E442" stroke="#5b3a00" />}
      {id === 'family_member' && <path d="M20 22c1-8 23-9 24 0c-4-2-9-4-12-2c-3-2-8 0-12 2z" fill="#2b1a0b" />}
      <circle cx="27" cy="27" r="1.6" fill="#1f2937" /><circle cx="37" cy="27" r="1.6" fill="#1f2937" />
      <path d="M27 33c3 2 7 2 10 0" stroke="#1f2937" strokeWidth="1.6" fill="none" />
    </svg>
  );
};

export const NpcPanel: React.FC<{
  latest: Record<string, { text: string; source: string; tick?: number }>;
  busy: boolean;
  onTalk: (npcId: string) => void;
}> = ({ latest, busy, onTalk }) => (
  <section className="npcs" aria-label="Characters">
    <h2 className="panel-title">People in the village</h2>
    <ul className="npc-list">
      {Object.entries(NPCS).map(([id, n]) => {
        const said = latest[id];
        return (
          <li key={id} className="npc" data-testid={`npc-${id}`}>
            <button className="npc-face" onClick={() => onTalk(id)} disabled={busy} aria-label={`Talk to ${n.name}, ${n.role}`}>
              <Portrait id={id} />
            </button>
            <div className="npc-body">
              <p className="npc-name"><strong>{n.name}</strong> <span className="muted">{n.role}</span></p>
              {said ? (
                <div className="bubble" data-testid={`bubble-${id}`}>
                  <p>{said.text}</p>
                  <SourceBadge source={said.source} />
                </div>
              ) : <p className="muted small">Tap the portrait to ask for advice.</p>}
            </div>
          </li>
        );
      })}
    </ul>
  </section>
);
