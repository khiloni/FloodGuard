import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HazardArt } from '../Logo';
import { BookOpen, Backpack, ListChecks, CircleHelp, WavesHorizontal, Check, X, Printer, ChevronRight, RotateCcw, Award } from '../icons';
import { DEPTHS, KIT, LESSONS, PLAN, QUIZ } from './content';
import { useLang } from '../../lib/i18n';

type Tab = 'learn' | 'depth' | 'kit' | 'plan' | 'quiz';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'learn', label: 'Lessons', icon: <BookOpen aria-hidden="true" /> },
  { id: 'depth', label: 'Water depth', icon: <WavesHorizontal aria-hidden="true" /> },
  { id: 'kit', label: 'Go-bag', icon: <Backpack aria-hidden="true" /> },
  { id: 'plan', label: 'Family plan', icon: <ListChecks aria-hidden="true" /> },
  { id: 'quiz', label: 'Quiz', icon: <CircleHelp aria-hidden="true" /> },
];

const PLAN_KEY = 'floodguard.plan.v1';

export const Academy: React.FC<{ reduced: boolean; onBack: () => void; onToast: (t: string) => void }> = ({ reduced, onBack, onToast }) => {
  const [tab, setTab] = useState<Tab>('learn');
  const { t } = useLang();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <main className="academy" id="main" data-testid="academy">
      <div className="academy-head">
        <div>
          <p className="eyebrow">{t('academy')}</p>
          <h1 tabIndex={-1} ref={ref}>{t('academyTitle')}</h1>
          <p className="muted">Short lessons, hands-on tools and a quiz. General knowledge for learning only: in a real emergency follow your local authorities.</p>
        </div>
        <button className="btn" onClick={onBack} data-testid="academy-back">{t('back')}</button>
      </div>
      <div className="academy-tabs" role="tablist" aria-label="Academy sections">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''}
            onClick={() => setTab(t.id)} data-testid={`academy-tab-${t.id}`}>{t.icon}<span>{t.label}</span></button>
        ))}
      </div>
      <div className="academy-body" role="tabpanel">
        {tab === 'learn' && <Lessons />}
        {tab === 'depth' && <DepthExplorer reduced={reduced} />}
        {tab === 'kit' && <KitBuilder onComplete={() => onToast('🎒 Go-bag ready')} />}
        {tab === 'plan' && <FamilyPlan onComplete={() => onToast('📋 Family plan complete')} />}
        {tab === 'quiz' && <Quiz onPass={() => onToast('🎓 Quiz passed')} />}
      </div>
    </main>
  );
};

const Lessons: React.FC = () => {
  const [open, setOpen] = useState<string | null>(LESSONS[0].id);
  return (
    <ul className="lessons" data-testid="lessons">
      {LESSONS.map((l) => (
        <li key={l.id} className={`lesson${open === l.id ? ' open' : ''}`}>
          <button className="lesson-head" aria-expanded={open === l.id} onClick={() => setOpen(open === l.id ? null : l.id)}>
            <HazardArt kind={l.art} />
            <span className="lesson-title">{l.title}</span>
          </button>
          {open === l.id && (
            <div className="lesson-body">
              <p>{l.summary}</p>
              <ul>{l.points.map((p) => <li key={p}>{p}</li>)}</ul>
              <p className="lesson-do"><strong>Do this:</strong> {l.doThis}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};

/** Slide the water up and see what each depth means for people and vehicles. */
const DepthExplorer: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const [cm, setCm] = useState(15);
  const level = [...DEPTHS].reverse().find((d) => cm >= d.cm) || DEPTHS[0];
  const ground = 300, px = 1.6; // 1 cm = 1.6 px
  const wy = ground - cm * px;
  const danger = cm >= 60 ? 'danger' : cm >= 15 ? 'warn' : 'ok';
  return (
    <section className="depth" aria-labelledby="depth-h" data-testid="depth-explorer">
      <h2 id="depth-h">How deep is too deep?</h2>
      <p className="muted">Moving water is far stronger than it looks. Slide the water level and watch what happens.</p>
      <div className="depth-grid">
        <svg viewBox="0 0 520 330" className="depth-art" role="img" aria-label={`Water ${cm} centimetres deep. ${level.text}`}>
          <defs>
            <linearGradient id="dw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5fb8ec" stopOpacity="0.85" /><stop offset="1" stopColor="#0b4f7c" stopOpacity="0.95" /></linearGradient>
            <linearGradient id="dsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d5a80" /><stop offset="1" stopColor="#98c1d9" /></linearGradient>
          </defs>
          <rect width="520" height="330" fill="url(#dsky)" />
          <rect y={ground} width="520" height="30" fill="#6b5b45" />
          {/* ruler */}
          <g transform="translate(20 0)">
            {[0, 15, 30, 60, 90, 120, 150].map((v) => (
              <g key={v} transform={`translate(0 ${ground - v * px})`}>
                <line x2="14" stroke="#fff" strokeWidth="2" /><text x="18" y="4" className="depth-tick">{v} cm</text>
              </g>
            ))}
          </g>
          {/* adult, child, car */}
          <g transform={`translate(130 ${ground})`} className={cm >= 15 && !reduced ? 'sway' : ''}>
            <circle cy="-160" r="14" fill="#f2c79a" /><rect x="-14" y="-145" width="28" height="70" rx="10" fill="#e76f51" />
            <rect x="-13" y="-78" width="11" height="78" rx="5" fill="#264653" /><rect x="2" y="-78" width="11" height="78" rx="5" fill="#264653" />
            <text y="22" textAnchor="middle" className="depth-tick">Adult</text>
          </g>
          <g transform={`translate(210 ${ground})`} className={cm >= 15 && !reduced ? 'sway' : ''}>
            <circle cy="-100" r="11" fill="#f2c79a" /><rect x="-10" y="-88" width="20" height="44" rx="8" fill="#2a9d8f" />
            <rect x="-9" y="-46" width="8" height="46" rx="4" fill="#264653" /><rect x="1" y="-46" width="8" height="46" rx="4" fill="#264653" />
            <text y="22" textAnchor="middle" className="depth-tick">Child</text>
          </g>
          <g transform={`translate(360 ${ground - (cm >= 30 ? Math.min(40, (cm - 30) * 0.8) : 0)}) rotate(${cm >= 60 ? -6 : 0})`}>
            <path d="M-80 -20 L-60 -50 H30 L60 -22 H80 V-6 H-80Z" fill="#f4a261" stroke="#7a4b1f" strokeWidth="2" />
            <rect x="-52" y="-46" width="36" height="20" fill="#cde7f5" /><rect x="-8" y="-46" width="34" height="20" fill="#cde7f5" />
            <circle cx="-48" cy="-4" r="13" fill="#222" /><circle cx="48" cy="-4" r="13" fill="#222" />
            <text y="22" textAnchor="middle" className="depth-tick">Car</text>
          </g>
          {cm > 0 && (
            <g>
              <rect y={wy} width="520" height={ground + 30 - wy} fill="url(#dw)" className="depth-water" />
              <path d={`M0 ${wy} q20 -5 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0`} fill="none" stroke="#e0f4ff" strokeWidth="2" opacity="0.8" className={reduced ? '' : 'depth-wave'} />
              {cm >= 15 && [0, 1, 2].map((i) => (
                <path key={i} d={`M${60 + i * 150} ${Math.min(ground - 6, wy + 14 + i * 6)} h40 l-8 -6 m8 6 l-8 6`} stroke="#ffffff" strokeWidth="2.5" fill="none" opacity="0.8" className={reduced ? '' : 'depth-current'} />
              ))}
            </g>
          )}
        </svg>
        <div className={`depth-card tone-${danger}`} aria-live="polite">
          <label className="depth-slider">
            <span>Water depth: <strong>{cm} cm</strong></span>
            <input type="range" min="0" max="150" step="5" value={cm} onChange={(e) => setCm(Number(e.target.value))} data-testid="depth-slider" />
          </label>
          <h3>{level.title}</h3>
          <p>{level.text}</p>
          <p className="muted small">Rule of thumb taught worldwide: <strong>turn around, don't drown.</strong> Never walk, swim or drive through floodwater.</p>
        </div>
      </div>
    </section>
  );
};

const KitBuilder: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [picked, setPicked] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const items = useMemo(() => [...KIT].sort((a, b) => a.label.localeCompare(b.label)), []);
  const essentials = KIT.filter((k) => k.essential);
  const missing = essentials.filter((k) => !picked.includes(k.id));
  const wrong = KIT.filter((k) => !k.essential && picked.includes(k.id));
  const perfect = checked && !missing.length && !wrong.length;
  useEffect(() => { if (perfect) onComplete(); }, [perfect, onComplete]);
  const toggle = (id: string) => { setChecked(false); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };
  return (
    <section aria-labelledby="kit-h" data-testid="kit-builder">
      <h2 id="kit-h">Pack a go-bag</h2>
      <p className="muted">You may have minutes to leave. Pick what belongs in an emergency bag, then check your packing.</p>
      <div className="kit-bag" aria-live="polite"><span className="kit-bag-icon" aria-hidden="true">🎒</span> {picked.length} item{picked.length === 1 ? '' : 's'} packed</div>
      <ul className="kit-grid">
        {items.map((k) => {
          const on = picked.includes(k.id);
          const verdict = checked ? (k.essential ? (on ? 'good' : 'missed') : (on ? 'bad' : '')) : '';
          return (
            <li key={k.id}>
              <button className={`kit-item${on ? ' on' : ''} ${verdict}`} aria-pressed={on} onClick={() => toggle(k.id)} data-testid={`kit-${k.id}`}>
                <span className="kit-emoji" aria-hidden="true">{k.emoji}</span>
                <span>{k.label}</span>
                {verdict === 'good' && <Check aria-label="Good choice" />}
                {verdict === 'bad' && <X aria-label="Leave this out" />}
                {verdict === 'missed' && <span className="kit-missed">missing</span>}
              </button>
              {checked && (verdict === 'bad' || verdict === 'missed') && <p className="kit-why small">{k.why}</p>}
            </li>
          );
        })}
      </ul>
      <div className="row-actions">
        <button className="btn primary" onClick={() => setChecked(true)} data-testid="kit-check">Check my bag</button>
        <button className="btn ghost" onClick={() => { setPicked([]); setChecked(false); }}><RotateCcw aria-hidden="true" /> Start again</button>
      </div>
      {checked && (
        <p className={`result ${perfect ? 'ok' : 'warn'}`} role="status" data-testid="kit-result">
          {perfect ? 'Perfect bag: light, complete and ready to grab.'
            : `${missing.length ? `${missing.length} essential item${missing.length > 1 ? 's' : ''} missing. ` : ''}${wrong.length ? `${wrong.length} item${wrong.length > 1 ? 's' : ''} would slow you down.` : ''}`}
        </p>
      )}
    </section>
  );
};

const FamilyPlan: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [done, setDone] = useState<number[]>(() => {
    try { return JSON.parse(window.localStorage.getItem(PLAN_KEY) || '[]'); } catch { return []; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(PLAN_KEY, JSON.stringify(done)); } catch { /* storage unavailable */ }
    if (done.length === PLAN.length) onComplete();
  }, [done, onComplete]);
  const pct = Math.round((done.length / PLAN.length) * 100);
  return (
    <section aria-labelledby="plan-h" className="plan" data-testid="family-plan">
      <h2 id="plan-h">Make a family flood plan</h2>
      <p className="muted">Talk these through with your family. Your ticks stay on this device only.</p>
      <div className="plan-meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Plan complete"><span style={{ width: `${pct}%` }} /></div>
      <ol className="plan-list">
        {PLAN.map((p, i) => (
          <li key={p}>
            <label className="check">
              <input type="checkbox" checked={done.includes(i)} onChange={() => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))} />
              <span>{p}</span>
            </label>
          </li>
        ))}
      </ol>
      <div className="row-actions">
        <button className="btn" onClick={() => window.print()}><Printer aria-hidden="true" /> Print this plan</button>
      </div>
      <p className="muted small">Emergency: <strong>112</strong> · Disaster helpline: <strong>1078</strong> (India). Add your district control room number too.</p>
    </section>
  );
};

const Quiz: React.FC<{ onPass: () => void }> = ({ onPass }) => {
  const [i, setI] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const q = QUIZ[i];
  const answer = (k: number) => {
    if (choice !== null) return;
    setChoice(k);
    if (k === q.answer) setScore((s) => s + 1);
  };
  const next = () => {
    if (i === QUIZ.length - 1) {
      setDone(true);
      if (score >= 8) onPass();
      return;
    }
    setI(i + 1); setChoice(null);
  };
  if (done) {
    const pass = score >= 8;
    return (
      <section className="quiz-done" data-testid="quiz-done">
        <div className="quiz-score"><Award aria-hidden="true" /> {score} / {QUIZ.length}</div>
        <p>{pass ? 'Excellent. You know the key safety rules.' : 'Good start. Read the lessons and try again: aim for 8 or more.'}</p>
        <button className="btn primary" onClick={() => { setI(0); setChoice(null); setScore(0); setDone(false); }}><RotateCcw aria-hidden="true" /> Try again</button>
      </section>
    );
  }
  return (
    <section className="quiz" aria-labelledby="quiz-q" data-testid="quiz">
      <p className="quiz-progress">Question {i + 1} of {QUIZ.length} · score {score}</p>
      <div className="quiz-bar"><span style={{ width: `${(i / QUIZ.length) * 100}%` }} /></div>
      <h2 id="quiz-q">{q.q}</h2>
      <ul className="quiz-options">
        {q.options.map((o, k) => {
          const state = choice === null ? '' : k === q.answer ? 'right' : k === choice ? 'wrong' : 'dim';
          return (
            <li key={o}>
              <button className={`quiz-option ${state}`} onClick={() => answer(k)} disabled={choice !== null && state === 'dim'} data-testid={`quiz-option-${k}`}>
                {o} {state === 'right' && <Check aria-label="Correct" />}{state === 'wrong' && <X aria-label="Not correct" />}
              </button>
            </li>
          );
        })}
      </ul>
      {choice !== null && (
        <div className={`quiz-why ${choice === q.answer ? 'ok' : 'warn'}`} role="status">
          <p><strong>{choice === q.answer ? 'Correct.' : 'Not quite.'}</strong> {q.why}</p>
          <button className="btn primary small" onClick={next} data-testid="quiz-next">{i === QUIZ.length - 1 ? 'See my score' : 'Next question'} <ChevronRight aria-hidden="true" /></button>
        </div>
      )}
    </section>
  );
};
