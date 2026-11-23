import React from 'react';
import type { Action, HelpResponse } from '../api/types';
import { describeAction } from '../lib/actions';
import { SourceBadge } from './MessageLog';
import { Lightbulb, X } from './icons';

/** "What should I do?" results: 2-3 options from the engine's advisor. Choosing one only pre-fills the order. */
export const HelpPanel: React.FC<{
  help: HelpResponse | null;
  loading: boolean;
  names: Record<string, string>;
  onUse: (a: Action) => void;
  onClose: () => void;
}> = ({ help, loading, names, onUse, onClose }) => (
  <div className="help-panel" role="region" aria-label="Suggestions" data-testid="help-panel">
    <div className="help-head">
      <h3><Lightbulb aria-hidden="true" /> Options right now</h3>
      {help && <SourceBadge source={help.source} />}
      <button className="btn icon ghost" onClick={onClose} aria-label="Close suggestions"><X aria-hidden="true" /></button>
    </div>
    {loading && <p className="muted">Looking at the situation…</p>}
    {help && (
      <>
        <ol className="help-list">
          {help.options.map((o, i) => (
            <li key={i} className="help-option" data-testid="help-option">
              <p className="help-title"><strong>{describeAction(o.action, names)}</strong></p>
              <p className="help-trade">{o.tradeoff}</p>
              {o.rule_card && <p className="help-card" title={o.rule_card.guidance}>Learn: {o.rule_card.id} {o.rule_card.title}</p>}
              <button className="btn small" onClick={() => onUse(o.action)} data-testid="help-use">Use this order</button>
            </li>
          ))}
        </ol>
        <p className="muted small">{help.note}</p>
      </>
    )}
  </div>
);

/** An order waiting for confirmation (from Help, an NPC suggestion or a parameter picker). */
export const PendingOrder: React.FC<{
  action: Action;
  names: Record<string, string>;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  from?: string;
}> = ({ action, names, busy, onConfirm, onCancel, from }) => (
  <div className="pending" role="group" aria-label="Order ready to confirm" data-testid="pending-order">
    <p><span className="muted small">{from ? `Suggested by ${from}` : 'Ready to send'}</span><br /><strong>{describeAction(action, names)}</strong></p>
    <div className="pending-actions">
      <button className="btn ghost small" onClick={onCancel}>Cancel</button>
      <button className="btn primary small" onClick={onConfirm} disabled={busy} data-testid="pending-confirm">Give this order</button>
    </div>
  </div>
);
