import React from 'react';
import type { SimEvent, Phase } from '../api/types';
import { Play, Pause, RotateCcw } from './icons';

const MARKER_TYPES: Record<string, string> = {
  warning_issued: 'Warning', evacuation_ordered: 'Evacuation order', shelter_opened: 'Shelter opened',
  embankment_breached: 'Breach', casualty_occurred: 'People lost', phase_changed: 'Phase change',
  clean_water_provided: 'Clean water', medical_camp_opened: 'Medical camp', power_restored: 'Power restored',
  residents_returned: 'Residents returned', disease_risk_high: 'Disease risk high', search_and_rescue_completed: 'Rescue',
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
  bands.push({ phase: 'before', from: 0, to: fs ?? Math.max(currentTick, 1), label: 'Before' });
  if (fs !== null) bands.push({ phase: 'flood', from: fs, to: rs ?? currentTick, label: 'During' });
  if (rs !== null) bands.push({ phase: 'recovery', from: rs, to: currentTick, label: 'After' });
  bands.push({ phase: 'ahead', from: currentTick, to: maxTicks, label: '' });

  const markers = events.filter((e) => MARKER_TYPES[e.type]);
  const shown = replayTick ?? currentTick;

  return (
    <section className="timeline" aria-label="Story timeline" data-testid="timeline">
      <div className="timeline-track">
        {bands.filter((b) => b.to > b.from).map((b) => (
          <div key={b.phase} className={`band band-${b.phase}`} style={{ left: pct(b.from), width: pct(b.to - b.from) }}>
            {b.label && <span>{b.label}</span>}
          </div>
        ))}
        {peakTick !== null && (
          <div className="peak-mark" style={{ left: pct(peakTick) }} title={`Forecast peak at tick ${peakTick}`} data-testid="peak-mark">
            <span>peak</span>
          </div>
        )}
        {markers.map((m, i) => (
          <div key={`${m.type}-${m.tick}-${i}`} className={`marker marker-${m.type}`} style={{ left: pct(m.tick) }}
            title={`Tick ${m.tick}: ${MARKER_TYPES[m.type]}`} />
        ))}
        <div className="now" style={{ left: pct(shown) }} aria-hidden="true" />
      </div>
      <div className="timeline-controls">
        {replayTick === null ? (
          <>
            <span className="timeline-now">Tick <strong data-testid="timeline-tick">{currentTick}</strong> of {maxTicks} <span className="muted small hide-sm">· {minutesPerTick} min each</span></span>
            <button className="btn small" onClick={onEnterReplay} disabled={!replayAvailable || currentTick === 0} data-testid="replay-open">
              <RotateCcw aria-hidden="true" /> Replay
            </button>
          </>
        ) : (
          <>
            <button className="btn small icon" onClick={onTogglePlay} aria-label={replayPlaying ? 'Pause replay' : 'Play replay'} data-testid="replay-play">
              {replayPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <label className="scrubber">
              <span className="sr-only">Replay tick</span>
              <input type="range" min={0} max={currentTick} step={1} value={replayTick}
                onChange={(e) => onScrub(Number(e.target.value))} data-testid="replay-scrubber"
                aria-valuetext={`Tick ${replayTick} of ${currentTick}`} />
            </label>
            <span className="timeline-now">Replay tick <strong data-testid="replay-tick">{replayTick}</strong></span>
            <button className="btn small" onClick={onExitReplay} data-testid="replay-exit">Back to live</button>
          </>
        )}
      </div>
    </section>
  );
};
