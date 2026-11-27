import React from 'react';
import type { Summary } from '../api/types';
import { Sparkles, Eye, X } from './icons';
import { useLang } from '../lib/i18n';

export interface FutureBranch {
  frames: { tick: number; water_level_cm: number; phase: string; summary: Summary;
    zones: Record<string, { at_home: number; vulnerable: number; water_depth_cm: number; lost: number }> }[];
  end_tick: number; safe: number; at_home: number; vulnerable_at_home: number; lost: number;
  embankment_breached: boolean; events: { tick: number; type: string; description: string }[];
}
export interface Preview { status: string; reject_reason?: string; horizon: number; from_tick: number; with_order: FutureBranch; without_order: FutureBranch }
export type Peek = { branch: 'with_order' | 'without_order'; frame: number } | null;

/** Sparkline of people still at home (at risk) per tick, for one future. */
const Spark: React.FC<{ b: FutureBranch; max: number; color: string }> = ({ b, max, color }) => {
  const pts = b.frames.map((f, i) => {
    const atRisk = Object.values(f.zones).reduce((a, z) => a + z.at_home, 0);
    const x = b.frames.length > 1 ? (i / (b.frames.length - 1)) * 100 : 50;
    return `${x},${30 - (atRisk / Math.max(1, max)) * 28}`;
  }).join(' ');
  return <svg viewBox="0 0 100 32" className="lens-spark" aria-hidden="true" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg>;
};

/** Future Lens: two honest futures side by side, played by the same deterministic engine. */
export const FutureLens: React.FC<{
  preview: Preview | null; loading: boolean; orderLabel: string; peek: Peek; onPeek: (p: Peek) => void;
}> = ({ preview, loading, orderLabel, peek, onPeek }) => {
  const { t } = useLang();
  if (loading) return <div className="lens loading" data-testid="future-lens"><Sparkles aria-hidden="true" /> {t('lensLoading')}</div>;
  if (!preview) return null;
  if (preview.status !== 'ok') return <div className="lens" data-testid="future-lens"><p className="small">{preview.reject_reason}</p></div>;
  const a = preview.with_order, b = preview.without_order;
  const max = Math.max(1, ...[a, b].flatMap((x) => x.frames.map((f) => Object.values(f.zones).reduce((s, z) => s + z.at_home, 0))));
  const hours = preview.horizon;
  const better = a.lost < b.lost || (a.lost === b.lost && a.safe > b.safe) ? 'with' : a.lost > b.lost || a.safe < b.safe ? 'without' : 'same';
  const Col = ({ x, id, title, color }: { x: FutureBranch; id: 'with_order' | 'without_order'; title: string; color: string }) => (
    <div className={`lens-col${peek?.branch === id ? ' on' : ''}`}>
      <p className="lens-title" style={{ color }}>{title}</p>
      <Spark b={x} max={max} color={color} />
      <ul className="lens-stats">
        <li><strong>{x.safe}</strong> {t('lensSafe')}</li>
        <li><strong>{x.at_home}</strong> {t('lensAtHome')}</li>
        <li className={x.lost ? 'bad' : ''}><strong>{x.lost}</strong> {t('lensLost')}</li>
        {x.embankment_breached && <li className="bad">{t('lensBreach')}</li>}
      </ul>
      <div className="lens-peek" role="group" aria-label={t('lensWatch')}>
        <button className="btn small" onClick={() => onPeek(peek?.branch === id ? null : { branch: id, frame: x.frames.length - 1 })} aria-pressed={peek?.branch === id} data-testid={`lens-peek-${id}`}>
          <Eye aria-hidden="true" /> {t('lensWatch')}
        </button>
        {peek?.branch === id && (
          <input type="range" min={0} max={Math.max(0, x.frames.length - 1)} value={peek.frame}
            onChange={(e) => onPeek({ branch: id, frame: Number(e.target.value) })} aria-label={t('lensScrub')} />
        )}
      </div>
    </div>
  );
  return (
    <section className="lens" data-testid="future-lens" aria-label="Future Lens">
      <div className="lens-head">
        <p><Sparkles aria-hidden="true" /> <strong>Future Lens</strong> <span className="muted small">{t('lensNext')} {hours} {t('ticks')}</span></p>
        {peek && <button className="btn icon ghost small" onClick={() => onPeek(null)} aria-label={t('lensClose')}><X aria-hidden="true" /></button>}
      </div>
      <div className="lens-cols">
        <Col x={a} id="with_order" title={`${t('lensIf')}: ${orderLabel}`} color="#5fe0b8" />
        <Col x={b} id="without_order" title={t('lensIfWait')} color="#ff9a66" />
      </div>
      <p className={`lens-verdict ${better}`}>{better === 'with' ? t('lensBetter') : better === 'without' ? t('lensWorse') : t('lensSame')}</p>
      <p className="muted small">{t('lensNote')}</p>
    </section>
  );
};
