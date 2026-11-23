import React, { useEffect, useRef, useState } from 'react';
import type { ScenarioInfo } from '../api/types';
import { HazardArt } from './Logo';
import { ChevronRight, Languages, Gauge } from './icons';

export interface StartOptions { scenario_id: string; difficulty: string; language: string }

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', hint: 'More resources, lower water' },
  { id: 'standard', label: 'Standard', hint: 'As designed' },
  { id: 'hard', label: 'Hard', hint: 'Fewer resources, higher water, slower help' },
];
const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी (Hindi)' },
];

export const ScenarioSelect: React.FC<{
  scenarios: ScenarioInfo[];
  busy: boolean;
  onStart: (o: StartOptions) => void;
}> = ({ scenarios, busy, onStart }) => {
  const [difficulty, setDifficulty] = useState('standard');
  const [language, setLanguage] = useState('en');
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  return (
    <main className="select-screen" id="main" data-testid="scenario-select">
      <div className="select-head">
        <h1 tabIndex={-1} ref={titleRef}>Choose a story</h1>
        <p className="muted">Each story is a stylized teaching model of a real kind of hazard. You lead the response before, during and after it.</p>
        <div className="select-controls">
          <fieldset className="seg" aria-label="Difficulty">
            <legend><Gauge aria-hidden="true" /> Difficulty</legend>
            {DIFFICULTIES.map((d) => (
              <label key={d.id} className={difficulty === d.id ? 'on' : ''} title={d.hint}>
                <input type="radio" name="difficulty" value={d.id} checked={difficulty === d.id}
                  onChange={() => setDifficulty(d.id)} data-testid={`difficulty-${d.id}`} />
                {d.label}
              </label>
            ))}
          </fieldset>
          <label className="lang">
            <Languages aria-hidden="true" /> <span>AI narration language</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} data-testid="language-select">
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
        </div>
        {language !== 'en' && <p className="muted small">Menus stay in English. AI narration and characters use your language when the AI is on; fixed template text stays in English.</p>}
      </div>
      <ul className="scenario-cards" aria-label="Stories">
        {scenarios.map((s, i) => (
          <li key={s.id} className={`scenario-card hazard-${s.illustration}`} data-testid={`scenario-${s.id}`}>
            <HazardArt kind={s.illustration} />
            <div className="scenario-body">
              <p className="scenario-meta">
                <span className="chip-hazard">{s.hazard_label}</span>
                <span className={`chip-diff diff-${s.difficulty_label.toLowerCase()}`}>{s.difficulty_label}</span>
              </p>
              <h2>{s.name}</h2>
              <p className="hook">{s.hook}</p>
              <p className="muted small">{s.total_ticks} turns of {s.tick_duration_minutes} min · {s.npcs.length} characters · {s.shelters.length} shelter{s.shelters.length > 1 ? 's' : ''}</p>
              <button className="btn primary" disabled={busy} onClick={() => onStart({ scenario_id: s.id, difficulty, language })}
                data-testid={`start-${s.id}`} autoFocus={i === 0 ? undefined : undefined}>
                Begin this story <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
};
