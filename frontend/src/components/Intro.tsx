import React, { useEffect, useRef, useState } from 'react';
import { tr } from '../lib/i18n';
import type { ScenarioInfo } from '../api/types';
import { ChevronRight } from './icons';

export const Intro: React.FC<{ scenario: ScenarioInfo | null; onDone: () => void }> = ({ scenario, onDone }) => {
  const steps = [
    { title: scenario?.name || tr('Your story'), body: scenario?.description || '' },
    { title: tr('You lead the response'), body: tr('The story covers the hours before the hazard, the hazard itself and the recovery after it. Each order uses {m} minutes of story time.', { m: scenario?.tick_duration_minutes ?? 30 }) },
    { title: tr('Two pages, one screen'), body: tr('Page 1, Act: the live map and your orders. Page 2, Village: the conversation with the narrator and the people, and the status. Swipe, use the tabs, or press the arrow keys to switch. The simulation engine decides what happens; nothing here is a real forecast.') },
  ];
  const [i, setI] = useState(0);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, [i]);
  const last = i === steps.length - 1;
  return (
    <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title" data-testid="intro">
      <div className="card intro-card" key={i}>
        <p className="intro-step">Step {i + 1} of {steps.length}</p>
        <h2 id="intro-title" tabIndex={-1} ref={ref}>{steps[i].title}</h2>
        <p>{steps[i].body}</p>
        <div className="intro-actions">
          <button className="btn ghost" onClick={onDone} data-testid="intro-skip">{tr('Skip intro')}</button>
          <button className="btn primary" onClick={() => (last ? onDone() : setI(i + 1))} data-testid="intro-next">
            {last ? tr('Begin the story') : tr('Next')} <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
