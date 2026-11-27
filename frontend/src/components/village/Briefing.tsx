import React, { useState } from 'react';
import { tr, N_ } from '../../lib/i18n';
import type { SimEvent, ScenarioInfo, Summary } from '../../api/types';
import type { Message } from '../MessageLog';
import { MessageLog } from '../MessageLog';
import { BookOpen, ScrollText, ListChecks } from '../icons';

const MECHANIC_TIPS: Record<string, string> = {
  drains: N_('Blocked drains flood streets fast while it rains, and the underpass loses road access at only 15 cm. Clear drains early; you have two crews.'),
  dam_release: N_('The dam will release extra water a few hours in. Warn every village before it starts, and ask early for a slower, staggered release.'),
  cyclone: N_('Fishing boats are still at sea. Recall them early: they need time to reach the harbour before landfall, when wind also cuts power.'),
  none: N_('The river rises towards a peak. Warn, open the shelter and move people from low ground before roads flood; reinforce the bund before the peak.'),
};

export const Briefing: React.FC<{ scenario: ScenarioInfo | null; s: Summary }> = ({ scenario, s }) => {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900);
  const mech = scenario?.mechanic_type || 'none';
  return (
    <div className="briefing" data-testid="briefing">
      <button className="briefing-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <BookOpen aria-hidden="true" /> {tr('Briefing and how to play')}
      </button>
      {open && (
        <div className="briefing-body">
          <p>{scenario?.description}</p>
          <p className="tip"><strong>{tr('This story:')}</strong> {tr(MECHANIC_TIPS[mech] || MECHANIC_TIPS.none)}</p>
          <ul>
            <li>{tr('Each order uses one turn of {m} minutes. Talking to someone also uses a turn.', { m: scenario?.tick_duration_minutes ?? 30 })}</li>
            <li>{tr('Warning level {w} cm, danger level {d} cm. After the peak the story moves into recovery.', { w: s.warning_level_cm, d: s.danger_level_cm })}</li>
            <li>{tr('"What should I do?" lists options from the simulation; nothing happens until you confirm an order.')}</li>
            <li>{tr('This is a stylized teaching model, not a flood forecast or emergency guidance.')}</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export const Logs: React.FC<{ messages: Message[]; events: SimEvent[]; llmOn: boolean }> = ({ messages, events, llmOn }) => {
  const [tab, setTab] = useState<'story' | 'events'>('story');
  return (
    <div className="logs">
      <div className="group-tabs" role="tablist" aria-label={tr('Logs')}>
        <button role="tab" aria-selected={tab === 'story'} className={tab === 'story' ? 'on' : ''} onClick={() => setTab('story')} data-testid="log-story"><ScrollText aria-hidden="true" /> {tr('Story')}</button>
        <button role="tab" aria-selected={tab === 'events'} className={tab === 'events' ? 'on' : ''} onClick={() => setTab('events')} data-testid="log-events"><ListChecks aria-hidden="true" /> {tr('Event log')}</button>
      </div>
      {tab === 'story' ? <MessageLog messages={messages} llmOn={llmOn} /> : (
        <ol className="event-log" data-testid="event-log">
          {[...events].reverse().filter((e) => e.type !== 'wait_tick').slice(0, 200).map((e, i) => (
            <li key={`${e.tick}-${i}`} className={`ev ev-${e.details?.phase || 'flood'}`}>
              <span className="ev-tick">T{e.tick}</span> <span className="ev-text">{e.description}</span>
              <span className="ev-cause muted small">because: {e.caused_by}</span>
            </li>
          ))}
          {events.length === 0 && <li className="muted">{tr('No events yet.')}</li>}
        </ol>
      )}
    </div>
  );
};
