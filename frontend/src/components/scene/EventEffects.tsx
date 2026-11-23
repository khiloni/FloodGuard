import React from 'react';
import type { GameEvent, Layout, Point } from '../../api/types';
import {
  decorAt, depot, embankmentMid, mapEdgeEntry, pathFrom, pointAt, routeFor, shelterCenter, site, zoneCenter,
} from '../../lib/geometry';
import { npcs } from '../../lib/actions';

export interface FxItem {
  key: string;
  event: GameEvent;
  delay: number; // ms
}

export const FX_DURATION_MS = 2600;

interface Ctx {
  layout: Layout;
  reduced: boolean;
  delay: number;
}

const style = (ctx: Ctx, extra: React.CSSProperties = {}): React.CSSProperties => ({
  animationDelay: `${ctx.delay}ms`,
  ...extra,
});

/** A glyph that travels along a path (CSS motion path). Static at the end point when motion is reduced. */
const Mover: React.FC<{ ctx: Ctx; pts: Point[]; children: React.ReactNode }> = ({ ctx, pts, children }) => {
  if (pts.length < 2) return null;
  if (ctx.reduced) {
    const [x, y] = pts[pts.length - 1];
    return <g transform={`translate(${x} ${y})`} className="fx-static" style={style(ctx)}>{children}</g>;
  }
  return (
    <g className="fx-move" style={style(ctx, { offsetPath: `path('${pathFrom(pts)}')`, offsetRotate: '0deg', offsetAnchor: '0px 0px' } as React.CSSProperties)}>
      {children}
    </g>
  );
};

const Pop: React.FC<{ ctx: Ctx; at: Point; children: React.ReactNode }> = ({ ctx, at: [x, y], children }) => (
  <g transform={`translate(${x} ${y})`}>
    <g className={ctx.reduced ? 'fx-static' : 'fx-pop'} style={style(ctx)}>{children}</g>
  </g>
);

const Rings: React.FC<{ ctx: Ctx; at: Point; color: string }> = ({ ctx, at: [x, y], color }) => (
  <g transform={`translate(${x} ${y})`}>
    {[0, 300, 600].map((d) => (
      <circle key={d} r="40" fill="none" stroke={color} strokeWidth="4"
        className={ctx.reduced ? 'fx-static' : 'fx-ring'} style={{ animationDelay: `${ctx.delay + d}ms` }} />
    ))}
  </g>
);

const Label: React.FC<{ text: string; y?: number; tone?: string }> = ({ text, y = -30, tone = '' }) => (
  <g>
    <rect x={-text.length * 4.6 - 8} y={y - 16} width={text.length * 9.2 + 16} height="24" rx="12" fill="#ffffff" stroke="#1f2937" strokeWidth="1.5" />
    <text y={y + 1} textAnchor="middle" className={`svg-label small ${tone}`}>{text}</text>
  </g>
);

const People: React.FC<{ n: number; color?: string; vulnerable?: boolean }> = ({ n, color = '#1f2937', vulnerable }) => (
  <g>
    {Array.from({ length: Math.min(5, Math.max(1, n)) }, (_, i) => vulnerable
      ? <g key={i} transform={`translate(${i * 12 - 24} 0)`}><circle r="6" fill="#fff" stroke="#CC79A7" strokeWidth="2.5" /><circle r="2.4" fill="#CC79A7" /></g>
      : <circle key={i} cx={i * 11 - 22} r="4.5" fill={color} />)}
  </g>
);

const Boat = () => <use href="#boat" x="-16" y="-9" width="32" height="18" />;
const Truck = () => <use href="#truck" x="-16" y="-10" width="32" height="20" />;

function renderFx(ev: GameEvent, ctx: Ctx): React.ReactNode {
  const L = ctx.layout;
  const zc = zoneCenter(L, ev.zone);
  const sc = shelterCenter(L);
  const route = routeFor(L, ev.zone);
  const d = ev.details || {};
  switch (ev.type) {
    case 'warning_issued': {
      const targets = ev.zone ? [ev.zone] : L.zones.map((z) => z.id);
      return <g>{targets.map((t) => <Rings key={t} ctx={ctx} at={zoneCenter(L, t)} color="#E69F00" />)}<Pop ctx={ctx} at={[500, 40]}><Label text="Warning broadcast" y={0} /></Pop></g>;
    }
    case 'evacuation_ordered':
      return <Pop ctx={ctx} at={zc}><Label text="Evacuate!" tone="warn" /><path d="M-6 -6 L6 0 L-6 6 Z" fill="#D55E00" /></Pop>;
    case 'transport_assigned':
      return <g><Mover ctx={ctx} pts={[depot(L), ...(route.length ? [route[0]] : [zc])]}>{d.transport_type === 'vehicle' ? <Truck /> : <Boat />}</Mover>
        <Pop ctx={ctx} at={route[0] || zc}><Label text={`${d.count ?? 1} ${d.transport_type === 'vehicle' ? 'truck' : 'boat'}${Number(d.count) > 1 ? 's' : ''} on the way`} y={-34} /></Pop></g>;
    case 'vulnerable_prioritized':
      return <Pop ctx={ctx} at={zc}><circle r="16" fill="#CC79A7" /><path d="M0 7 L-8 -1 A4.5 4.5 0 0 1 0 -7 A4.5 4.5 0 0 1 8 -1 Z" fill="#fff" /><Label text="Vulnerable first" y={-28} /></Pop>;
    case 'shelter_opened':
      return <Pop ctx={ctx} at={sc}><circle r="58" fill="#F0E442" opacity="0.45" /><Label text="Shelter open" y={-54} /></Pop>;
    case 'embankment_reinforced': {
      const [x, y] = embankmentMid(L);
      const rows = Math.min(3, Math.max(1, Math.round(Number(d.sandbags_used || 100) / 100)));
      return <g>{Array.from({ length: rows }, (_, r) => (
        <Mover key={r} ctx={{ ...ctx, delay: ctx.delay + r * 350 }} pts={[[x, y - 80], [x, y - 6 - r * 9]]}>
          <g>{[0, 1, 2].map((i) => <rect key={i} x={-21 + i * 14 + (r % 2) * 7} y="-6" width="13" height="9" rx="3" fill="#c8a165" stroke="#5b3a1e" />)}</g>
        </Mover>))}
        <Pop ctx={ctx} at={[x, y]}><Label text={`+${d.sandbags_used ?? ''} sandbags`} y={-44} /></Pop></g>;
    }
    case 'npc_consulted': {
      const npc = npcs()[String(d.npc_id || ev.target)];
      return <Pop ctx={ctx} at={zoneCenter(L, npc?.zone)}><Label text={`${npc?.name || 'Character'} speaks`} y={-44} /></Pop>;
    }
    case 'water_level_advanced': {
      const c = L.river?.center_path || [];
      return <g className={ctx.reduced ? 'fx-static' : 'fx-ripple'} style={style(ctx)}>
        <path d={pathFrom(c)} fill="none" stroke="#ffffff" strokeWidth="5" strokeDasharray="30 30" opacity="0.8" />
      </g>;
    }
    case 'road_inundated':
      return <g>{route.length > 1 && <path d={pathFrom(route.slice(0, 2))} stroke="#0072B2" strokeWidth="14" fill="none" className={ctx.reduced ? 'fx-static' : 'fx-flash'} style={style(ctx)} />}
        <Pop ctx={ctx} at={route[0] || zc}><Label text="Road under water" tone="warn" /></Pop></g>;
    case 'zone_flooded': {
      const z = L.zones.find((zz) => zz.id === ev.zone);
      if (!z) return null;
      return <g>
        <rect x={z.x} y={z.y} width={z.width} height={z.height} rx="10" fill="#0072B2" opacity="0.5"
          className={ctx.reduced ? 'fx-static' : 'fx-fill-up'} style={style(ctx, { transformOrigin: `${z.x}px ${z.y + z.height}px` })} />
        <Pop ctx={ctx} at={zc}><Label text="Water entering homes" tone="warn" /></Pop></g>;
    }
    case 'embankment_overflow': {
      const [x, y] = embankmentMid(L);
      return <Mover ctx={ctx} pts={[[x, y + 10], [x, y - 60]]}><path d="M-14 0 L0 -18 L14 0 Z" fill="#56B4E9" stroke="#0072B2" strokeWidth="2" /></Mover>;
    }
    case 'embankment_breached': {
      const at = embankmentMid(L);
      return <Pop ctx={ctx} at={at}><circle r="44" fill="#56B4E9" opacity="0.7" /><path d="M-18 -10 l10 8 l-6 6 l14 10" stroke="#2b1a0b" strokeWidth="4" fill="none" /><Label text="Embankment breached" tone="danger" y={-52} /></Pop>;
    }
    case 'residents_evacuated':
      return <Mover ctx={ctx} pts={route.length ? route : [zc, sc]}><People n={Math.ceil((d.evacuated || 10) / 10)} /></Mover>;
    case 'vulnerable_evacuated':
      return <Mover ctx={ctx} pts={route.length ? route : [zc, sc]}><People n={Math.ceil((d.vulnerable_count || 5) / 5)} vulnerable /></Mover>;
    case 'casualty_occurred':
      // Calm, non-graphic marker.
      return <Pop ctx={ctx} at={zc}><circle r="22" fill="#6b7280" opacity="0.7" /><Label text="People lost" tone="muted" y={-30} /></Pop>;
    case 'session_completed':
      return <Pop ctx={ctx} at={[500, 300]}><circle r="260" fill="#F0E442" opacity="0.18" /><Label text="Story complete" y={0} /></Pop>;
    case 'wait_tick':
      return <Pop ctx={ctx} at={[500, 40]}><circle r="16" fill="#fff" stroke="#1f2937" strokeWidth="2" /><line x1="0" y1="0" x2="0" y2="-11" stroke="#1f2937" strokeWidth="2.5" className={ctx.reduced ? '' : 'fx-spin'} /><line x1="0" y1="0" x2="7" y2="0" stroke="#1f2937" strokeWidth="2.5" /></Pop>;
    case 'phase_changed':
      return <Pop ctx={ctx} at={[500, 300]}>
        <rect x="-260" y="-36" width="520" height="64" rx="14" fill="#1f2937" opacity="0.9" />
        <text y="8" textAnchor="middle" className="svg-banner">{d.to_phase === 'recovery' ? 'After the flood: recovery begins' : 'The flood has begun'}</text>
      </Pop>;
    case 'water_receded': {
      const z = L.zones.find((zz) => zz.id === ev.zone);
      if (!z) return null;
      return <g><rect x={z.x} y={z.y} width={z.width} height={z.height} rx="10" fill="#56B4E9" opacity="0.6"
        className={ctx.reduced ? 'fx-static' : 'fx-drain'} style={style(ctx, { transformOrigin: `${z.x}px ${z.y + z.height}px` })} />
        <Pop ctx={ctx} at={zc}><Label text="Water receding" /></Pop></g>;
    }
    case 'search_and_rescue_completed':
      return <Mover ctx={ctx} pts={[depot(L), zc, ...(route.length ? route.slice(1) : [sc])]}><g><Boat /><g transform="translate(0 -16)"><People n={Math.ceil((d.rescued || 10) / 10)} /></g></g></Mover>;
    case 'supplies_distributed':
      return <Mover ctx={ctx} pts={[site(L, 'supply_depot', [960, 230]), sc]}><g><Truck /><rect x="-10" y="-22" width="12" height="10" fill="#c8a165" stroke="#5b3a1e" /></g></Mover>;
    case 'shelter_supplies_low':
      return <Pop ctx={ctx} at={[sc[0] - 70, sc[1]]}><rect x="-12" y="-12" width="24" height="20" fill="#c8a165" stroke="#5b3a1e" strokeWidth="2" className={ctx.reduced ? '' : 'fx-blink'} /><Label text="Supplies low" tone="warn" y={-24} /></Pop>;
    case 'shelter_supplies_exhausted':
      return <Pop ctx={ctx} at={[sc[0] - 70, sc[1]]}><rect x="-12" y="-12" width="24" height="20" fill="none" stroke="#D55E00" strokeWidth="2.5" strokeDasharray="4 3" /><Label text="Supplies ran out" tone="danger" y={-24} /></Pop>;
    case 'clean_water_provided': {
      const at = site(L, 'water_point', [640, 120]);
      return <g>{[0, 1, 2].map((i) => (
        <Mover key={i} ctx={{ ...ctx, delay: ctx.delay + i * 250 }} pts={[[at[0] - 14 + i * 14, at[1] - 50], [at[0] - 14 + i * 14, at[1] - 10]]}>
          <path d="M0 -8 C5 -2 6 1 6 3 A6 6 0 0 1 -6 3 C-6 1 -5 -2 0 -8Z" fill="#56B4E9" stroke="#0072B2" />
        </Mover>))}
        <Pop ctx={ctx} at={at}><Label text="Clean water flowing" y={-58} /></Pop></g>;
    }
    case 'medical_camp_opened':
      return <Pop ctx={ctx} at={site(L, 'medical_camp', [760, 60])}><path d="M-24 16 L0 -18 L24 16 Z" fill="#009E73" stroke="#04634a" strokeWidth="2" /><Label text="Medical camp open" y={-28} /></Pop>;
    case 'disease_risk_high':
      return <Pop ctx={ctx} at={[sc[0] - 40, sc[1] + 70]}><path d="M0 -18 L18 14 H-18 Z" fill="#E69F00" stroke="#5b3a00" strokeWidth="2" /><text y="10" textAnchor="middle" className="svg-label small">!</text><Label text={`Disease risk ${d.disease_risk ?? ''}`} tone="warn" y={-28} /></Pop>;
    case 'illness_reported':
      return <Pop ctx={ctx} at={[sc[0] + 10, sc[1] + 72]}><rect x="-3" y="-16" width="6" height="22" rx="3" fill="#fff" stroke="#D55E00" strokeWidth="2" /><circle cy="9" r="6" fill="#D55E00" /><Label text={`${d.new_cases ?? ''} people ill`} tone="warn" y={-26} /></Pop>;
    case 'illness_treated':
      return <Pop ctx={ctx} at={site(L, 'medical_camp', [760, 60])}><circle r="22" fill="#009E73" opacity="0.4" className={ctx.reduced ? '' : 'fx-pulse'} /><path d="M-8 0 h5 l3 -7 l4 12 l3 -5 h5" fill="none" stroke="#04634a" strokeWidth="3" /><Label text={`${d.treated ?? ''} treated`} y={-30} /></Pop>;
    case 'power_restored': {
      const at = site(L, 'substation', [380, 110]);
      return <g>{L.zones.map((z) => <path key={z.id} d={pathFrom([at, zoneCenter(L, z.id)])} stroke="#F0E442" strokeWidth="4" strokeDasharray="10 8" className={ctx.reduced ? 'fx-static' : 'fx-flash'} style={style(ctx)} />)}
        <Pop ctx={ctx} at={at}><path d="M4 -16 L-9 3 H0 L-4 16 L10 -4 H1 Z" fill="#F0E442" stroke="#333" strokeWidth="2" transform="scale(1.6)" /><Label text="Power restored" y={-40} /></Pop></g>;
    }
    case 'health_centre_reopened':
      return <Pop ctx={ctx} at={site(L, 'health_centre', [600, 60])}><rect x="-24" y="-18" width="48" height="36" fill="#F0E442" opacity="0.6" /><Label text="Health centre open" y={-30} /></Pop>;
    case 'road_cleared': {
      const start = route[0] || zc;
      return <g><Mover ctx={ctx} pts={[start, [start[0] - 60, start[1] + 40]]}><path d="M-10 4 L-2 -6 L4 2 Z" fill="#7a5230" /></Mover>
        <Pop ctx={ctx} at={pointAt(route, 0.15)}><Label text="Road cleared" /></Pop></g>;
    }
    case 'damage_surveyed': {
      const z = L.zones.find((zz) => zz.id === ev.zone);
      if (!z) return null;
      return <Mover ctx={ctx} pts={[[z.x + 10, z.y + z.height / 2], [z.x + z.width - 10, z.y + z.height / 2]]}>
        <g><circle r="12" fill="#ffffff" fillOpacity="0.6" stroke="#1f2937" strokeWidth="3" /><line x1="8" y1="8" x2="18" y2="18" stroke="#1f2937" strokeWidth="4" /></g>
      </Mover>;
    }
    case 'residents_returned':
      return <Mover ctx={ctx} pts={route.length ? [...route].reverse() : [sc, zc]}><People n={Math.ceil((d.returned || 10) / 20)} color="#009E73" /></Mover>;
    case 'support_requested':
      return <Pop ctx={ctx} at={[ (L.canvas?.width ?? 1000) - 120, 40]}><Label text={`Help requested · ETA tick ${d.eta_tick ?? '?'}`} y={0} /></Pop>;
    case 'support_arrived': {
      const sc2 = shelterCenter(L);
      const edge = mapEdgeEntry(L);
      return <g>{[0, 1, 2].map((i) => (
        <Mover key={i} ctx={{ ...ctx, delay: ctx.delay + i * 300 }} pts={[edge, [sc2[0] + 40 + i * 26, sc2[1] + 50]]}><Truck /></Mover>))}
        <Pop ctx={ctx} at={[sc2[0], sc2[1] + 90]}><Label text={`Convoy: +${d.boats ?? 0} boats, +${d.vehicles ?? 0} trucks`} y={0} /></Pop></g>;
    }
    case 'resource_depleted': {
      const at = d.resource === 'sandbags' ? embankmentMid(L) : depot(L);
      return <Pop ctx={ctx} at={at}><g opacity="0.85"><circle r="18" fill="#6b7280" /><path d="M-9 -9 L9 9 M9 -9 L-9 9" stroke="#fff" strokeWidth="4" /></g>
        <Label text={`No ${String(d.resource || ev.target)} left`} tone="danger" y={-30} /></Pop>;
    }
    case 'drains_cleared':
      return <Pop ctx={ctx} at={zc}><g>{[-12, 0, 12].map((x) => <line key={x} x1={x} y1="-10" x2={x} y2="10" stroke="#1f2937" strokeWidth="3" />)}
        <circle r="18" fill="none" stroke="#009E73" strokeWidth="3" /></g><Label text="Drains cleared" y={-28} /></Pop>;
    case 'drain_overflow':
      return <g><Rings ctx={ctx} at={zc} color="#0072B2" />
        <Pop ctx={ctx} at={zc}><Label text={`Drains overflow +${d.extra_cm ?? ''} cm`} tone="warn" y={-34} /></Pop></g>;
    case 'dam_release_notice': {
      const at = decorAt(L, 'dam', [80, 300]);
      return <g><Rings ctx={ctx} at={at} color="#E69F00" /><Pop ctx={ctx} at={at}><Label text={`Dam release at tick ${d.release_tick ?? '?'}`} tone="warn" y={-40} /></Pop></g>;
    }
    case 'dam_release_started': {
      const at = decorAt(L, 'dam', [80, 300]);
      const c = L.river?.center_path || [at, [500, 300]];
      return <g><path d={pathFrom(c)} fill="none" stroke="#56B4E9" strokeWidth="22" opacity="0.7" className={ctx.reduced ? 'fx-static' : 'fx-flash'} style={style(ctx)} />
        <Pop ctx={ctx} at={at}><Label text={`Dam releasing +${d.added_cm ?? ''} cm`} tone="danger" y={-40} /></Pop></g>;
    }
    case 'release_staggered': {
      const at = decorAt(L, 'dam', [80, 300]);
      return <Pop ctx={ctx} at={at}><circle r="20" fill="#009E73" opacity="0.5" /><Label text="Release will be staggered" y={-40} /></Pop>;
    }
    case 'fishing_boats_recalled': {
      const at = decorAt(L, 'sea_boats', [800, 560]);
      return <g><Rings ctx={ctx} at={at} color="#F0E442" /><Pop ctx={ctx} at={at}><Label text="Boats recalled by radio" y={-36} /></Pop></g>;
    }
    case 'fishing_boats_returned': {
      const at = decorAt(L, 'sea_boats', [800, 560]);
      return <g>{[0, 1, 2].map((i) => (
        <Mover key={i} ctx={{ ...ctx, delay: ctx.delay + i * 250 }} pts={[[at[0] + i * 30, at[1]], depot(L)]}><Boat /></Mover>))}
        <Pop ctx={ctx} at={depot(L)}><Label text={`${d.boats ?? ''} boats safe in harbour`} y={-30} /></Pop></g>;
    }
    case 'cyclone_landfall':
      return <Pop ctx={ctx} at={[(L.canvas?.width ?? 1000) / 2, 120]}>
        <g className={ctx.reduced ? '' : 'fx-spin'}><path d="M0 -40 A40 40 0 0 1 40 0 M0 40 A40 40 0 0 1 -40 0" stroke="#cbd5e1" strokeWidth="10" fill="none" /><circle r="10" fill="#cbd5e1" /></g>
        <Label text="Cyclone landfall" tone="danger" y={-56} /></Pop>;
    case 'fishers_stranded': {
      const at = decorAt(L, 'sea_boats', [800, 560]);
      return <Pop ctx={ctx} at={at}><circle r="22" fill="#6b7280" opacity="0.7" /><Label text={`${d.fishers ?? ''} fishers missing at sea`} tone="muted" y={-30} /></Pop>;
    }
    default:
      return <Pop ctx={ctx} at={zc}><Label text={ev.type.replace(/_/g, ' ')} /></Pop>;
  }
}

export const EventEffects: React.FC<{ layout: Layout; items: FxItem[]; reduced: boolean }> = ({ layout, items, reduced }) => (
  <g className="fx-layer" aria-hidden="true">
    {items.map((it) => (
      <g key={it.key} data-testid={`fx-${it.event.type}`} className={`fx fx-${it.event.type}`}>
        {renderFx(it.event, { layout, reduced, delay: it.delay })}
      </g>
    ))}
  </g>
);
