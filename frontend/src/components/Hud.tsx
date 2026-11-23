import React from 'react';
import type { Summary } from '../api/types';
import { Clock, Users, Sparkles } from './icons';

function timeLeft(s: Summary, minutesPerTick: number): string {
  const mins = Math.max(0, s.max_ticks - s.tick) * minutesPerTick;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** Compact strip shown on both pages. All numbers come from the API summary. */
export const Hud: React.FC<{ s: Summary; minutesPerTick: number }> = ({ s, minutesPerTick }) => {
  const lo = Math.min(s.normal_level_cm, s.water_level_cm) - 20;
  const hi = Math.max(s.crest_level_cm, s.water_level_cm) + 20;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
  const status = s.water_level_cm >= s.danger_level_cm ? 'danger' : s.water_level_cm >= s.warning_level_cm ? 'warning' : 'normal';
  return (
    <div className="hud" role="group" aria-label="Situation summary" data-testid="hud">
      <div className="hud-item" title="Time left in the story">
        <Clock aria-hidden="true" />
        <span className="hud-label">Left</span>
        <strong data-testid="hud-time">{timeLeft(s, minutesPerTick)}</strong>
      </div>
      <div className={`hud-item hud-water ${status}`} title={`Water ${s.water_level_cm} cm; warning ${s.warning_level_cm} cm; danger ${s.danger_level_cm} cm`}>
        <span className="hud-label">Water</span>
        <span className="hud-bar" aria-hidden="true">
          <span className="hud-fill" style={{ width: pct(s.water_level_cm) }} />
          <span className="hud-line warn" style={{ left: pct(s.warning_level_cm) }} />
          <span className="hud-line danger" style={{ left: pct(s.danger_level_cm) }} />
        </span>
        <strong data-testid="hud-water">{s.water_level_cm} cm</strong>
        <span className={`hud-word ${status}`}>{status === 'normal' ? 'normal' : status === 'warning' ? 'warning' : 'DANGER'}</span>
      </div>
      <div className={`hud-item${(s.residents_at_risk ?? 0) > 0 ? ' warn' : ''}`} title="Residents still in areas that are flooded or forecast to flood">
        <Users aria-hidden="true" />
        <span className="hud-label">At risk</span>
        <strong data-testid="hud-risk">{s.residents_at_risk ?? 0}</strong>
      </div>
      <div className="hud-item" title="Score so far, calculated by the simulation engine">
        <Sparkles aria-hidden="true" />
        <span className="hud-label">Score</span>
        <strong data-testid="hud-score">{s.score_so_far ?? 0}</strong>
      </div>
    </div>
  );
};
