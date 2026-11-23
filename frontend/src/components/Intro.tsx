import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from './icons';

const STEPS = [
  { title: 'A riverside village in the monsoon', body: 'Three wards sit beside a rising tributary: Ward 1 on low ground, Ward 2 around the market and Ward 3 on the ridge. A school on the hill can be opened as a shelter.' },
  { title: 'You are the village decision-maker', body: 'Your story covers the hours before the flood, the flood itself and the recovery after it. Each action you take uses 30 minutes of story time.' },
  { title: 'Watch the village respond', body: 'Use the buttons or type a command. The simulation engine decides what happens; the village map, the timeline and the characters show you the results. Nothing here is a real forecast.' },
];

export const Intro: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, [i]);
  const last = i === STEPS.length - 1;
  return (
    <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title" data-testid="intro">
      <div className="card intro-card" key={i}>
        <p className="intro-step">Story {i + 1} of {STEPS.length}</p>
        <h2 id="intro-title" tabIndex={-1} ref={ref}>{STEPS[i].title}</h2>
        <p>{STEPS[i].body}</p>
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
