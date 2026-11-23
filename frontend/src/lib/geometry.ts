import type { Layout, Point } from '../api/types';

export const pathFrom = (pts: Point[]): string =>
  pts.length ? `M${pts.map(([x, y]) => `${x} ${y}`).join(' L')}` : '';

export const reversePath = (pts: Point[]): string => pathFrom([...pts].reverse());

export function pointAt(pts: Point[], t: number): Point {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0];
  const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = segs.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]) {
      const f = segs[i] ? d / segs[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    }
    d -= segs[i];
  }
  return pts[pts.length - 1];
}

export function zoneCenter(layout: Layout, zoneId?: string | null): Point {
  const z = layout.zones.find((zz) => zz.id === zoneId);
  return z ? [z.x + z.width / 2, z.y + z.height / 2] : [500, 300];
}

export function shelterCenter(layout: Layout): Point {
  const s = layout.shelters[0];
  return s ? [s.x + s.width / 2, s.y + s.height / 2] : [900, 100];
}

export function routeFor(layout: Layout, zoneId?: string | null): Point[] {
  return layout.routes.find((r) => r.zone_id === zoneId)?.waypoints || [];
}

export function embankmentMid(layout: Layout): Point {
  const segs = layout.embankment?.segments || [];
  const mid = segs[Math.floor(segs.length / 2)];
  return mid ? [(mid.start[0] + mid.end[0]) / 2, (mid.start[1] + mid.end[1]) / 2] : [430, 430];
}

export function site(layout: Layout, key: string, fallback: Point): Point {
  const s = layout.recovery_sites?.[key];
  return s ? [s.x, s.y] : fallback;
}

export function depot(layout: Layout): Point {
  const j = layout.decor?.jetty;
  return j ? [j.x, j.y] : [120, 435];
}

/** Grid of dot positions inside a box, filled row by row. */
export function dotGrid(x: number, y: number, w: number, count: number, gap = 13): Point[] {
  const cols = Math.max(1, Math.floor(w / gap));
  return Array.from({ length: count }, (_, i) => [x + (i % cols) * gap, y + Math.floor(i / cols) * gap] as Point);
}

/** Position of a named decor item (dam, sea_boats, first underpass), with a fallback. */
export function decorAt(layout: Layout, key: 'dam' | 'sea_boats' | 'underpass' | 'jetty', fallback: Point): Point {
  const d = layout.decor || {};
  const v = key === 'underpass' ? d.underpasses?.[0] : (d as any)[key];
  return v ? [v.x, v.y] : fallback;
}

/** Where outside help enters the map: the far end of the first road route (map edge). */
export function mapEdgeEntry(layout: Layout): Point {
  const w = layout.canvas?.width ?? 1000;
  const sc = shelterCenter(layout);
  return [w + 40, sc[1]];
}
