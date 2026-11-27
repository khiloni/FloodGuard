import React, { useState } from 'react';
import type { Action } from '../api/types';
import { describeAction } from '../lib/actions';
import { Send, Mic } from './icons';

interface Props {
  examples: string[];
  busy: boolean;
  clarify: { question: string; options: Action[] } | null;
  zoneNames: Record<string, string>;
  onText: (t: string) => void;
  onOption: (a: Action) => void;
  onMic?: () => void;
  listening?: boolean;
  micLabel?: string;
}

export const CommandBox: React.FC<Props> = ({ examples, busy, clarify, zoneNames, onText, onOption, onMic, listening, micLabel }) => {
  const [text, setText] = useState('');
  const send = (t: string) => {
    const v = t.trim();
    if (!v || busy) return;
    onText(v);
    setText('');
  };
  return (
    <section className="command" aria-label="Type a command">
      {clarify && (
        <div className="clarify" role="group" aria-labelledby="clarify-q" data-testid="clarify">
          <p id="clarify-q"><strong>Which did you mean?</strong> {clarify.question}</p>
          <div className="chips">
            {clarify.options.map((o, i) => (
              <button key={i} className="chip option" onClick={() => onOption(o)} disabled={busy} data-testid="clarify-option">
                {describeAction(o, zoneNames)}
              </button>
            ))}
          </div>
          <p className="muted small">Time does not pass until you choose.</p>
        </div>
      )}
      <form className="command-form" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <label htmlFor="cmd" className="sr-only">Command</label>
        <input id="cmd" type="text" value={text} maxLength={400} onChange={(e) => setText(e.target.value)}
          placeholder="Type an order, e.g. evacuate ward 1" autoComplete="off" data-testid="command-input" />
        {onMic && (
          <button type="button" className={`btn icon mic${listening ? ' listening' : ''}`} onClick={onMic} disabled={busy}
            aria-pressed={!!listening} aria-label={micLabel || 'Speak an order'} title={micLabel || 'Speak an order'} data-testid="mic">
            <Mic aria-hidden="true" />
          </button>
        )}
        <button type="submit" className="btn primary" disabled={busy || !text.trim()} data-testid="command-send">
          <Send aria-hidden="true" /> Send
        </button>
      </form>
      <div className="chips" aria-label="Example commands">
        {examples.map((ex) => (
          <button key={ex} className="chip" onClick={() => send(ex)} disabled={busy} data-testid="example-chip">{ex}</button>
        ))}
      </div>
    </section>
  );
};
