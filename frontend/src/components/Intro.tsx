import React, { useEffect, useRef, useState } from 'react';
import type { ScenarioInfo } from '../api/types';
import { ChevronRight } from './icons';

export const Intro: React.FC<{ scenario: ScenarioInfo | null; onDone: () => void }> = ({ scenario, onDone }) => {
  const steps = [
    { title: scenario?.name || 'Your story', body: scenario?.description || '' },
    { title: 'You lead the response', body: `The story covers the hours before the hazard, the hazard itself and the recovery after it. Each order uses ${scenario?.tick_duration_minutes ?? 30} minutes of story time.` },
    { title: 'Two pages, one screen', body: 'Page 1, Act: the live map and your orders. Page 2, Village: status, the event log and the people you can talk to. Swipe, use the tabs, or press the arrow keys to switch. The simulation engine decides what happens; nothing here is a real forecast.' },
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
          <button className="btn ghost" onClick={onDone} data-testid="intro-skip">Skip intro</button>
          <button className="btn primary" onClick={() => (last ? onDone() : setI(i + 1))} data-testid="intro-next">
            {last ? 'Begin the story' : 'Next'} <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
