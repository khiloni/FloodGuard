// Player progress kept only in this browser (localStorage): best scores, stars and medals.
// Nothing is sent to the server. Scores measure play in a teaching simulation, nothing more.
import type { Report } from '../api/types';

const KEY = 'floodguard.progress.v1';

export interface Medal { id: string; title: string; detail: string; emoji: string }

export const MEDALS: Medal[] = [
  { id: 'first-story', title: 'First Responder', detail: 'Finish your first story.', emoji: '🛟' },
  { id: 'no-one-lost', title: 'No One Left Behind', detail: 'Finish a story with nobody lost.', emoji: '🤝' },
  { id: 'vulnerable-first', title: 'Care First', detail: 'Move at least 50 vulnerable residents first in one story.', emoji: '💗' },
  { id: 'healthy-camp', title: 'Clean Water Hero', detail: 'Keep peak disease risk below 40.', emoji: '💧' },
  { id: 'trusted', title: 'Trusted Voice', detail: 'End a story with community trust of 75 or more.', emoji: '📣' },
  { id: 'homecoming', title: 'Homecoming', detail: 'Bring at least 300 residents back home.', emoji: '🏡' },
  { id: 'three-stars', title: 'Master Planner', detail: 'Earn three stars in any story.', emoji: '🌟' },
  { id: 'hard-mode', title: 'Steel Nerves', detail: 'Finish any story on hard with two stars or more.', emoji: '⛰️' },
  { id: 'all-stories', title: 'Every Shore', detail: 'Finish all six stories.', emoji: '🗺️' },
  { id: 'academy', title: 'Academy Graduate', detail: 'Score 8 or more in the Flood Academy quiz.', emoji: '🎓' },
  { id: 'kit-ready', title: 'Go-Bag Ready', detail: 'Pack a complete emergency kit in the Academy.', emoji: '🎒' },
  { id: 'plan-made', title: 'Family Plan', detail: 'Tick every step of the family flood plan.', emoji: '📋' },
];

export interface Progress {
  best: Record<string, { score: number; stars: number; difficulty: string }>;
  finished: string[];
  medals: string[];
}

const empty = (): Progress => ({ best: {}, finished: [], medals: [] });

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw);
    return { best: p.best || {}, finished: p.finished || [], medals: p.medals || [] };
  } catch {
    return empty();
  }
}

function save(p: Progress) {
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}

export function starsFor(score: number): number {
  return score >= 85 ? 3 : score >= 65 ? 2 : score >= 40 ? 1 : 0;
}

/** Award a medal by id (Academy). Returns true if it is new. */
export function awardMedal(id: string): boolean {
  const p = loadProgress();
  if (p.medals.includes(id)) return false;
  p.medals.push(id);
  save(p);
  return true;
}

/** Record a finished story. Returns the stars and any medals earned for the first time. */
export function recordReport(report: Report, totalStories: number): { stars: number; newMedals: Medal[]; best: boolean } {
  const p = loadProgress();
  const sid = report.scenario_id || 'unknown';
  const score = report.score.total_score;
  const stars = starsFor(score);
  const diff = report.difficulty || 'standard';
  const prev = p.best[sid];
  const best = !prev || score > prev.score;
  if (best) p.best[sid] = { score, stars, difficulty: diff };
  if (!p.finished.includes(sid)) p.finished.push(sid);

  const d = report.score.details || {};
  const earned: string[] = ['first-story'];
  if ((d.total_lost ?? 1) === 0) earned.push('no-one-lost');
  if ((d.vulnerable_saved ?? 0) >= 50) earned.push('vulnerable-first');
  if (typeof d.peak_disease_risk === 'number' && d.peak_disease_risk < 40) earned.push('healthy-camp');
  if ((d.community_trust ?? 0) >= 75) earned.push('trusted');
  if ((d.residents_returned ?? 0) >= 300) earned.push('homecoming');
  if (stars === 3) earned.push('three-stars');
  if (diff === 'hard' && stars >= 2) earned.push('hard-mode');
  if (p.finished.length >= totalStories && totalStories >= 6) earned.push('all-stories');

  const newIds = earned.filter((id) => !p.medals.includes(id));
  p.medals.push(...newIds);
  save(p);
  return { stars, best, newMedals: MEDALS.filter((m) => newIds.includes(m.id)) };
}
