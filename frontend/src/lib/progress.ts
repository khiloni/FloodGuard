// Best score and stars per story, kept only in this browser (localStorage). Nothing is sent to the
// server. Scores measure play in a teaching simulation, nothing more.
import type { Report } from '../api/types';

const KEY = 'floodguard.progress.v1';

export interface Progress {
  best: Record<string, { score: number; stars: number; difficulty: string }>;
  finished: string[];
}

const empty = (): Progress => ({ best: {}, finished: [] });

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw);
    return { best: p.best || {}, finished: p.finished || [] };
  } catch {
    return empty();
  }
}

export function starsFor(score: number): number {
  return score >= 85 ? 3 : score >= 65 ? 2 : score >= 40 ? 1 : 0;
}

/** Record a finished story. Returns its stars and whether it beat the previous best. */
export function recordReport(report: Report): { stars: number; best: boolean } {
  const p = loadProgress();
  const sid = report.scenario_id || 'unknown';
  const score = report.score.total_score;
  const stars = starsFor(score);
  const prev = p.best[sid];
  const best = !prev || score > prev.score;
  if (best) p.best[sid] = { score, stars, difficulty: report.difficulty || 'standard' };
  if (!p.finished.includes(sid)) p.finished.push(sid);
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
  return { stars, best };
}
