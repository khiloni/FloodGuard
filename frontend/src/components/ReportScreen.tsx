import React, { useEffect, useRef } from 'react';
import type { Report } from '../api/types';
import { Siren, RotateCcw, Play, Star } from './icons';
import type { Medal } from '../lib/progress';

const COMPONENT_LABELS: Record<string, string> = {
  response_time_score: 'Early warning and evacuation timing',
  residents_safe_score: 'Residents brought to safety',
  vulnerable_protected_score: 'Vulnerable residents protected',
  resource_efficiency_score: 'Use of shelter, transport and sandbags',
  infrastructure_preserved_score: 'Embankment preserved',
  public_health_score: 'Public health (disease and illness)',
  essential_services_score: 'Clean water, power and roads',
  safe_return_score: 'Residents safely home',
  community_trust_score: 'Community trust',
};

const EVENT_LABELS: Record<string, string> = {
  outcome: 'Outcome',
};
const label = (t: string) => EVENT_LABELS[t] || t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const ReportScreen: React.FC<{ report: Report; earned?: { stars: number; medals: Medal[]; best: boolean } | null; onReplay: () => void; onRetry: () => void; onRestart: () => void }> = ({ report, earned, onReplay, onRetry, onRestart }) => {
  const cards = Object.fromEntries((report.rule_cards || []).map((c) => [c.id, c]));
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const d = report.score.details || {};
  return (
    <main className="report" data-testid="report">
      <h1 tabIndex={-1} ref={ref}>The end of the story</h1>
      <p className="lede">Here is what happened, and why. Scores measure choices inside this simulation only.
        {report.seed !== undefined && <span className="muted small"> Seed {report.seed} · {report.difficulty || 'standard'}</span>}</p>

      <div className="report-hero">
        <div className="score-col">
          <div className="score-ring" aria-label={`Final score ${report.score.total_score} out of 100`} data-testid="report-score"
            style={{ ['--pct' as any]: `${report.score.total_score}` }}>
            <span className="score-num">{report.score.total_score}</span><span className="score-max">/ 100</span>
          </div>
          {earned && (
            <p className="report-stars" aria-label={`${earned.stars} of 3 stars`} data-testid="report-stars">
              {[1, 2, 3].map((k) => <Star key={k} aria-hidden="true" className={k <= earned.stars ? 'star on' : 'star'} />)}
            </p>
          )}
          {earned?.best && <p className="muted small new-best">New personal best</p>}
        </div>
        <ul className="report-facts">
          <li><strong>{d.total_safe ?? '-'}</strong> people brought to shelter</li>
          <li><strong>{d.vulnerable_saved ?? '-'}</strong> vulnerable residents moved first</li>
          <li><strong>{d.total_lost ?? 0}</strong> people lost</li>
          <li><strong>{d.residents_returned ?? 0}</strong> residents back home</li>
          <li>Peak disease risk <strong>{d.peak_disease_risk ?? 0}</strong>/100</li>
          <li>Community trust <strong>{d.community_trust ?? 0}</strong>/100</li>
        </ul>
      </div>

      {earned && earned.medals.length > 0 && (
        <section aria-labelledby="medals-h" className="new-medals" data-testid="new-medals">
          <h2 id="medals-h">Medals earned</h2>
          <ul>
            {earned.medals.map((m) => (
              <li key={m.id} className="medal-card"><span className="medal-emoji" aria-hidden="true">{m.emoji}</span>
                <span><strong>{m.title}</strong><br /><span className="muted small">{m.detail}</span></span></li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="phases-h">
        <h2 id="phases-h">Three phases</h2>
        <div className="phase-cards">
          {report.phases.map((p) => (
            <article key={p.phase} className={`phase-card phase-${p.phase}`} data-testid={`report-phase-${p.phase}`}>
              <h3>{p.label}</h3>
              <p className="muted">{p.reached ? `Ticks ${p.start_tick}-${p.end_tick}` : 'Not reached'}</p>
              <p className="phase-points"><strong>{p.score_points}</strong> / {p.score_max} points</p>
              <ul>
                {Object.entries(p.score_components).map(([k, v]) => (
                  <li key={k}>{COMPONENT_LABELS[k] || k}: <strong>{v}</strong></li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="chain-h">
        <h2 id="chain-h">Cause and effect</h2>
        <ol className="chain" data-testid="causal-chain">
          {report.causal_chain.map((l, i) => (
            <li key={i} className={`chain-item phase-${l.phase}`}>
              <div className="chain-cause"><span className="chain-tick">{l.cause.tick !== null ? `Tick ${l.cause.tick}` : ''}</span> {l.cause.description || label(l.cause.type)}</div>
              <div className="chain-arrow" aria-hidden="true">→</div>
              <div className="chain-effect"><span className="chain-tick">{l.effect.tick !== null ? `Tick ${l.effect.tick}` : ''}</span> {l.effect.description || label(l.effect.type)}</div>
              <p className="chain-why">{l.explanation}</p>
              {(l.rule_card_ids || []).length > 0 && (
                <p className="chain-cards" data-testid="chain-cards">Learn: {(l.rule_card_ids || []).map((id) => (
                  <a key={id} href={`#card-${id}`} className="card-ref">{id} {cards[id]?.title || ''}</a>))}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {(report.rule_cards || []).length > 0 && (
        <section aria-labelledby="cards-h">
          <h2 id="cards-h">Rule cards behind these links</h2>
          <ul className="rule-cards" data-testid="rule-cards">
            {(report.rule_cards || []).map((c) => (
              <li key={c.id} id={`card-${c.id}`} className="rule-card" tabIndex={-1}>
                <p><strong>{c.id} · {c.title}</strong> <span className="muted small">{c.category}</span></p>
                <p className="small">{c.guidance}</p>
                {c.source_reference && <p className="muted small">Source: {c.source_reference}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="callout danger" role="note" data-testid="report-disclaimer">
        <Siren aria-hidden="true" />
        <span><strong>Remember:</strong> this score measures play in an educational simulation. It is not an assessment of
          real-world readiness or a flood forecast. In a real flood emergency call <strong>112</strong> (or the disaster
          helpline <strong>1078</strong>) and follow your local authorities.</span>
      </p>

      <div className="report-actions">
        <button className="btn" onClick={onReplay} data-testid="report-replay"><Play aria-hidden="true" /> Watch the replay</button>
        <button className="btn" onClick={onRetry} data-testid="report-retry" title={`Same story, same seed (${report.seed ?? '-'}) and difficulty`}><RotateCcw aria-hidden="true" /> Retry with the same seed</button>
        <button className="btn primary" onClick={onRestart} data-testid="report-restart">Choose another story</button>
      </div>
    </main>
  );
};
