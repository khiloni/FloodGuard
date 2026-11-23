import React, { useState } from 'react';
import type { GameEvent, ScenarioInfo, Summary } from '../../api/types';
import type { Message } from '../MessageLog';
import { MessageLog } from '../MessageLog';
import { BookOpen, ScrollText, ListChecks } from '../icons';

const MECHANIC_TIPS: Record<string, string> = {
  drains: 'Blocked drains flood streets fast while it rains, and the underpass loses road access at only 15 cm. Clear drains early; you have two crews.',
  dam_release: 'The dam will release extra water a few hours in. Warn every village before it starts, and ask early for a slower, staggered release.',
  cyclone: 'Fishing boats are still at sea. Recall them early: they need time to reach the harbour before landfall, when wind also cuts power.',
  none: 'The river rises towards a peak. Warn, open the shelter and move people from low ground before roads flood; reinforce the bund before the peak.',
};

export const Briefing: React.FC<{ scenario: ScenarioInfo | null; s: Summary }> = ({ scenario, s }) => {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900);
  const mech = scenario?.mechanic_type || 'none';
  return (
    <div className="briefing" data-testid="briefing">
      <button className="briefing-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <BookOpen aria-hidden="true" /> Briefing and how to play
      </button>
      {open && (
        <div className="briefing-body">
          <p>{scenario?.description}</p>
          <p className="tip"><strong>This story:</strong> {MECHANIC_TIPS[mech] || MECHANIC_TIPS.none}</p>
          <ul>
            <li>Each order uses one turn of {scenario?.tick_duration_minutes ?? 30} minutes. Talking to someone also uses a turn.</li>
            <li>Warning level {s.warning_level_cm} cm, danger level {s.danger_level_cm} cm. After the peak the story moves into recovery.</li>
            <li>"What should I do?" lists options from the simulation; nothing happens until you confirm an order.</li>
            <li>This is a stylized teaching model, not a flood forecast or emergency guidance.</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export const Logs: React.FC<{ messages: Message[]; events: GameEvent[]; llmOn: boolean }> = ({ messages, events, llmOn }) => {
  const [tab, setTab] = useState<'story' | 'events'>('story');
  return (
    <div className="logs">
      <div className="group-tabs" role="tablist" aria-label="Logs">
        <button role="tab" aria-selected={tab === 'story'} className={tab === 'story' ? 'on' : ''} onClick={() => setTab('story')} data-testid="log-story"><ScrollText aria-hidden="true" /> Story</button>
        <button role="tab" aria-selected={tab === 'events'} className={tab === 'events' ? 'on' : ''} onClick={() => setTab('events')} data-testid="log-events"><ListChecks aria-hidden="true" /> Event log</button>
      </div>
      {tab === 'story' ? <MessageLog messages={messages} llmOn={llmOn} /> : (
        <ol className="event-log" data-testid="event-log">
          {[...events].reverse().filter((e) => e.type !== 'wait_tick').slice(0, 200).map((e, i) => (
            <li key={`${e.tick}-${i}`} className={`ev ev-${e.details?.phase || 'flood'}`}>
              <span className="ev-tick">T{e.tick}</span> <span className="ev-text">{e.description}</span>
              <span className="ev-cause muted small">because: {e.caused_by}</span>
            </li>
          ))}
          {events.length === 0 && <li className="muted">No events yet.</li>}
        </ol>
      )}
    </div>
  );
};
