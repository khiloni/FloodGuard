import React, { useEffect, useRef } from 'react';
import { tr, N_ } from '../lib/i18n';
import type { Report } from '../api/types';
import { Siren, RotateCcw, Play, Star } from './icons';

const COMPONENT_LABELS: Record<string, string> = {
  response_time_score: N_('Early warning and evacuation timing'),
  residents_safe_score: N_('Residents brought to safety'),
  vulnerable_protected_score: N_('Vulnerable residents protected'),
  resource_efficiency_score: N_('Use of shelter, transport and sandbags'),
  infrastructure_preserved_score: N_('Embankment preserved'),
  public_health_score: N_('Public health (disease and illness)'),
  essential_services_score: N_('Clean water, power and roads'),
  safe_return_score: N_('Residents safely home'),
  community_trust_score: N_('Community trust'),
};

const EVENT_LABELS: Record<string, string> = {
  outcome: N_('Outcome'),
};
const label = (t: string) => tr(EVENT_LABELS[t] || '') || t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const ReportScreen: React.FC<{ report: Report; earned?: { stars: number; best: boolean } | null; onReplay: () => void; onRetry: () => void; onRestart: () => void }> = ({ report, earned, onReplay, onRetry, onRestart }) => {
  const cards = Object.fromEntries((report.rule_cards || []).map((c) => [c.id, c]));
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const d = report.score.details || {};
  return (
    <main className="report" data-testid="report">
      <h1 tabIndex={-1} ref={ref}>{tr('The end of the story')}</h1>
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
          {earned?.best && <p className="muted small new-best">{tr('New personal best')}</p>}
        </div>
        <ul className="report-facts">
          <li><strong>{d.total_safe ?? '-'}</strong> {tr('people brought to shelter')}</li>
          <li><strong>{d.vulnerable_saved ?? '-'}</strong> {tr('vulnerable residents moved first')}</li>
          <li><strong>{d.total_lost ?? 0}</strong> {tr('people lost')}</li>
          <li><strong>{d.residents_returned ?? 0}</strong> {tr('residents back home')}</li>
          <li>{tr('Peak disease risk')} <strong>{d.peak_disease_risk ?? 0}</strong>/100</li>
          <li>{tr('Community trust')} <strong>{d.community_trust ?? 0}</strong>/100</li>
        </ul>
      </div>

      <section aria-labelledby="phases-h">
        <h2 id="phases-h">{tr('Three phases')}</h2>
        <div className="phase-cards">
          {report.phases.map((p) => (
            <article key={p.phase} className={`phase-card phase-${p.phase}`} data-testid={`report-phase-${p.phase}`}>
              <h3>{p.label}</h3>
              <p className="muted">{p.reached ? `Ticks ${p.start_tick}-${p.end_tick}` : 'Not reached'}</p>
              <p className="phase-points"><strong>{p.score_points}</strong> / {p.score_max} points</p>
              <ul>
                {Object.entries(p.score_components).map(([k, v]) => (
                  <li key={k}>{tr(COMPONENT_LABELS[k] || k)}: <strong>{v}</strong></li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="chain-h">
        <h2 id="chain-h">{tr('Cause and effect')}</h2>
        <ol className="chain" data-testid="causal-chain">
          {report.causal_chain.map((l, i) => (
            <li key={i} className={`chain-item phase-${l.phase}`}>
              <div className="chain-cause"><span className="chain-tick">{l.cause.tick !== null ? `${tr('Tick')} ${l.cause.tick}` : ''}</span> {l.cause.description || label(l.cause.type)}</div>
              <div className="chain-arrow" aria-hidden="true">→</div>
              <div className="chain-effect"><span className="chain-tick">{l.effect.tick !== null ? `${tr('Tick')} ${l.effect.tick}` : ''}</span> {l.effect.description || label(l.effect.type)}</div>
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
          <h2 id="cards-h">{tr('Rule cards behind these links')}</h2>
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
        <span><strong>{tr('Remember:')}</strong> {tr('This score measures play in an educational simulation. It is not an assessment of real-world readiness or a flood forecast.')}{' '}
          {tr('In a real flood emergency call')} <strong>112</strong> {tr('(or the disaster helpline')} <strong>1078</strong>{tr(') and follow your local authorities.')}</span>
      </p>

      <div className="report-actions">
        <button className="btn" onClick={onReplay} data-testid="report-replay"><Play aria-hidden="true" /> {tr('Watch the replay')}</button>
        <button className="btn" onClick={onRetry} data-testid="report-retry" title={tr('Same story, same seed ({seed}) and difficulty', { seed: report.seed ?? '-' })}><RotateCcw aria-hidden="true" /> {tr('Retry with the same seed')}</button>
        <button className="btn primary" onClick={onRestart} data-testid="report-restart">{tr('Choose another story')}</button>
      </div>
    </main>
  );
};
