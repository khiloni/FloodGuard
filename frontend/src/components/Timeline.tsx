import React from 'react';
import { tr, N_ } from '../lib/i18n';
import type { SimEvent, Phase } from '../api/types';
import { Play, Pause, RotateCcw } from './icons';

const MARKER_TYPES: Record<string, string> = {
  warning_issued: N_('Warning'), evacuation_ordered: N_('Evacuation order'), shelter_opened: N_('Shelter opened'),
  embankment_breached: N_('Breach'), casualty_occurred: N_('People lost'), phase_changed: N_('Phase change'),
  clean_water_provided: N_('Clean water'), medical_camp_opened: N_('Medical camp'), power_restored: N_('Power restored'),
  residents_returned: N_('Residents returned'), disease_risk_high: N_('Disease risk high'), search_and_rescue_completed: N_('Rescue'),
};

interface Props {
  maxTicks: number;
  currentTick: number;
  minutesPerTick?: number;
  floodStart: number | null;
  recoveryStart: number | null;
  peakTick: number | null;
  events: SimEvent[];
  replayTick: number | null;
  replayPlaying: boolean;
  replayAvailable: boolean;
  onEnterReplay: () => void;
  onScrub: (t: number) => void;
  onTogglePlay: () => void;
  onExitReplay: () => void;
}

export const Timeline: React.FC<Props> = ({
  maxTicks, currentTick, minutesPerTick = 30, floodStart, recoveryStart, peakTick, events, replayTick, replayPlaying,
  replayAvailable, onEnterReplay, onScrub, onTogglePlay, onExitReplay,
}) => {
  const pct = (t: number) => `${(t / Math.max(1, maxTicks)) * 100}%`;
  const fs = floodStart ?? null;
  const rs = recoveryStart ?? null;
  const bands: { phase: Phase | 'ahead'; from: number; to: number; label: string }[] = [];
  bands.push({ phase: 'before', from: 0, to: fs ?? Math.max(currentTick, 1), label: N_('Before') });
  if (fs !== null) bands.push({ phase: 'flood', from: fs, to: rs ?? currentTick, label: N_('During') });
  if (rs !== null) bands.push({ phase: 'recovery', from: rs, to: currentTick, label: N_('After') });
  bands.push({ phase: 'ahead', from: currentTick, to: maxTicks, label: '' });

  const markers = events.filter((e) => MARKER_TYPES[e.type]);
  const shown = replayTick ?? currentTick;

  return (
    <section className="timeline" aria-label={tr('Story timeline')} data-testid="timeline">
      <div className="timeline-track">
        {bands.filter((b) => b.to > b.from).map((b) => (
          <div key={b.phase} className={`band band-${b.phase}`} style={{ left: pct(b.from), width: pct(b.to - b.from) }}>
            {b.label && <span>{tr(b.label)}</span>}
          </div>
        ))}
        {peakTick !== null && (
          <div className="peak-mark" style={{ left: pct(peakTick) }} title={`${tr('Forecast peak at tick')} ${peakTick}`} data-testid="peak-mark">
            <span>{tr('peak')}</span>
          </div>
        )}
        {markers.map((m, i) => (
          <div key={`${m.type}-${m.tick}-${i}`} className={`marker marker-${m.type}`} style={{ left: pct(m.tick) }}
            title={`${tr('Tick')} ${m.tick}: ${tr(MARKER_TYPES[m.type])}`} />
        ))}
        <div className="now" style={{ left: pct(shown) }} aria-hidden="true" />
      </div>
      <div className="timeline-controls">
        {replayTick === null ? (
          <>
            <span className="timeline-now">{tr('Tick')} <strong data-testid="timeline-tick">{currentTick}</strong> / {maxTicks} <span className="muted small hide-sm">· {tr('{m} min each', { m: minutesPerTick })}</span></span>
            <button className="btn small" onClick={onEnterReplay} disabled={!replayAvailable || currentTick === 0} data-testid="replay-open">
              <RotateCcw aria-hidden="true" /> {tr('Replay')}
            </button>
          </>
        ) : (
          <>
            <button className="btn small icon" onClick={onTogglePlay} aria-label={replayPlaying ? tr('Pause replay') : tr('Play replay')} data-testid="replay-play">
              {replayPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <label className="scrubber">
              <span className="sr-only">{tr('Replay tick')}</span>
              <input type="range" min={0} max={currentTick} step={1} value={replayTick}
                onChange={(e) => onScrub(Number(e.target.value))} data-testid="replay-scrubber"
                aria-valuetext={`${tr('Tick')} ${replayTick} / ${currentTick}`} />
            </label>
            <span className="timeline-now">{tr('Replay tick')} <strong data-testid="replay-tick">{replayTick}</strong></span>
            <button className="btn small" onClick={onExitReplay} data-testid="replay-exit">{tr('Back to live')}</button>
          </>
        )}
      </div>
    </section>
  );
};
