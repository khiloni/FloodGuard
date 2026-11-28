import React, { useEffect, useRef, useState } from 'react';
import { tr, N_ } from '../lib/i18n';
import type { ScenarioInfo } from '../api/types';
import { HazardArt } from './Logo';
import { ChevronRight, Languages, Gauge, GraduationCap, Star } from './icons';
import { loadProgress } from '../lib/progress';
import { LANGS, useLang, type Lang } from '../lib/i18n';

export interface StartOptions { scenario_id: string; difficulty: string; language: string }

const DIFFICULTIES = [
  { id: 'easy', label: N_('Easy'), hint: N_('More resources, lower water') },
  { id: 'standard', label: N_('Standard'), hint: N_('As designed') },
  { id: 'hard', label: N_('Hard'), hint: N_('Fewer resources, higher water, slower help') },
];

export const ScenarioSelect: React.FC<{
  scenarios: ScenarioInfo[];
  busy: boolean;
  onStart: (o: StartOptions) => void;
  onAcademy?: () => void;
}> = ({ scenarios, busy, onStart, onAcademy }) => {
  const progress = loadProgress();
  const [difficulty, setDifficulty] = useState('standard');
  const { lang: language, setLang, t } = useLang();
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  return (
    <main className="select-screen" id="main" data-testid="scenario-select">
      <div className="select-hero" aria-hidden="true">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="hero-waves">
          <path className="wave w1" d="M0 70 Q150 40 300 70 T600 70 T900 70 T1200 70 V120 H0Z" />
          <path className="wave w2" d="M0 85 Q150 60 300 85 T600 85 T900 85 T1200 85 V120 H0Z" />
          <path className="wave w3" d="M0 100 Q150 82 300 100 T600 100 T900 100 T1200 100 V120 H0Z" />
        </svg>
      </div>
      <div className="select-head">
        <div className="select-title-row">
          <h1 tabIndex={-1} ref={titleRef}>{t('chooseStory')}</h1>
          {onAcademy && (
            <button className="btn academy-btn" onClick={onAcademy} data-testid="open-academy">
              <GraduationCap aria-hidden="true" /> {t('academy')}
            </button>
          )}
        </div>
        <p className="muted">{t('chooseStoryLede')}</p>
        <div className="select-controls">
          <fieldset className="seg" aria-label={tr('Difficulty')}>
            <legend><Gauge aria-hidden="true" /> {t('difficulty')}</legend>
            {DIFFICULTIES.map((d) => (
              <label key={d.id} className={difficulty === d.id ? 'on' : ''} title={tr(d.hint)}>
                <input type="radio" name="difficulty" value={d.id} checked={difficulty === d.id}
                  onChange={() => setDifficulty(d.id)} data-testid={`difficulty-${d.id}`} />
                {t(d.id as 'easy')}
              </label>
            ))}
          </fieldset>
          <label className="lang">
            <Languages aria-hidden="true" /> <span>{t('language')}</span>
            <select value={language} onChange={(e) => setLang(e.target.value as Lang)} data-testid="language-select">
              {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
        </div>
        <div className="journey">
          <span className="muted small">{progress.finished.length} / {scenarios.length} {t('finished')}</span>
        </div>
        {language !== 'en' && <p className="muted small">{t('langNote')}</p>}
      </div>
      <ul className="scenario-cards" aria-label={tr('Stories')}>
        {scenarios.map((s, i) => (
          <li key={s.id} className={`scenario-card hazard-${s.illustration}`} data-testid={`scenario-${s.id}`}>
            <HazardArt kind={s.illustration} />
            <div className="scenario-body">
              <p className="scenario-meta">
                <span className="chip-hazard">{s.hazard_label}</span>
              </p>
              <h2>{s.name}</h2>
              {progress.best[s.id] && (
                <p className="best" data-testid={`best-${s.id}`} aria-label={`Best score ${progress.best[s.id].score}, ${progress.best[s.id].stars} of 3 stars`}>
                  {[1, 2, 3].map((k) => <Star key={k} aria-hidden="true" className={k <= progress.best[s.id].stars ? 'star on' : 'star'} />)}
                  <span>Best {progress.best[s.id].score}</span>
                </p>
              )}
              <p className="hook">{s.hook}</p>
              <p className="muted small">{tr('{t} turns of {m} min', { t: s.total_ticks, m: s.tick_duration_minutes })} · {tr('{c} characters', { c: s.npcs.length })} · {tr('Shelters: {n}', { n: s.shelters.length })}</p>
              <button className="btn primary" disabled={busy} onClick={() => onStart({ scenario_id: s.id, difficulty, language })}
                data-testid={`start-${s.id}`} autoFocus={i === 0 ? undefined : undefined}>
                {t('begin')} <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
};
