import React, { useMemo } from 'react';
import type { EngineState, Layout, Point, Summary } from '../../api/types';
import { dotGrid, pathFrom, pointAt, reversePath, routeFor } from '../../lib/geometry';
import { EventEffects, type FxItem } from './EventEffects';
import { CloudShadows, Landforms, Lightning, Rain, RecoveryJoy, SceneDefs, ShelterGlow, Stars, Tree } from './Atmosphere';

interface Props {
  layout: Layout;
  summary: Summary;
  state: EngineState | null;
  fx: FxItem[];
  reduced: boolean;
  replaying?: boolean;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function waterStatus(s: Summary): 'normal' | 'warning' | 'danger' {
  if (s.water_level_cm >= s.danger_level_cm) return 'danger';
  if (s.water_level_cm >= s.warning_level_cm) return 'warning';
  return 'normal';
}

/** Light level: 0 = bright day, 1 = deep night. Purely presentational, from tick and phase. */
function nightLevel(s: Summary, state: EngineState | null): number {
  const forecast = state?.forecast_cm || [];
  const peak = forecast.length ? forecast.indexOf(Math.max(...forecast)) + 1 : Math.round(s.max_ticks * 0.4);
  const fs = s.flood_start_tick ?? Math.max(1, peak - 6);
  if (s.phase === 'before') return 0.05 + 0.1 * clamp01(s.tick / Math.max(1, fs));
  if (s.phase === 'flood') {
    if (s.tick <= peak) return 0.15 + 0.5 * clamp01((s.tick - fs) / Math.max(1, peak - fs));
    return 0.65 - 0.25 * clamp01((s.tick - peak) / 5);
  }
  const rs = s.recovery_start_tick ?? s.tick;
  return Math.max(0, 0.3 - 0.06 * (s.tick - rs));
}

function sceneDescription(s: Summary, layout: Layout): string {
  const parts = [`Tick ${s.tick} of ${s.max_ticks}, ${s.phase === 'before' ? 'before the flood' : s.phase === 'flood' ? 'during the flood' : 'after the flood'}.`,
    `River at ${s.water_level_cm} cm (${waterStatus(s)}).`,
    `Embankment ${s.embankment_breached ? 'breached' : `${s.embankment_integrity}% intact`}.`,
    `Shelter ${s.shelter.is_open ? 'open' : 'closed'}, ${s.shelter.occupancy} of ${s.shelter.capacity} places used.`];
  for (const z of layout.zones) {
    const zs = s.zones[z.id];
    if (!zs) continue;
    parts.push(`${z.name}: ${zs.population_remaining} at home, ${zs.vulnerable_remaining} of them vulnerable, water ${zs.water_depth_cm} cm${zs.road_flooded ? ', road flooded' : ''}${zs.road_blocked ? ', road blocked by debris' : ''}.`);
  }
  return parts.join(' ');
}

export const VillageScene: React.FC<Props> = ({ layout, summary: s, state, fx, reduced, replaying }) => {
  const W = layout.canvas?.width ?? 1000;
  const H = layout.canvas?.height ?? 600;
  const status = waterStatus(s);
  const swell = clamp01((s.water_level_cm - s.normal_level_cm) / Math.max(1, s.crest_level_cm - s.normal_level_cm));
  const night = nightLevel(s, state);
  const rain = s.phase === 'before' ? 0.2 + 0.3 * swell : s.phase === 'flood' ? 0.55 + 0.45 * swell : 0;
  const isSea = layout.water_body === 'sea';
  const terrain = layout.decor?.peaks ? 'mountain' : layout.water_body === 'canal' ? 'city' : isSea ? 'coast' : 'green';
  const [land, landDark] = terrain === 'mountain' ? ['#c9d3b0', '#93a37f'] : terrain === 'city' ? ['#e4e7ec', '#bcc3cd']
    : terrain === 'coast' ? ['#e9e2c0', '#bfc99a'] : ['#e6efcf', '#b9cf98'];
  const rec = s.recovery;
  const inRecovery = s.phase === 'recovery';

  const river = layout.river;
  const northRaised: Point[] = useMemo(
    () => (river?.north_bank || []).map(([x, y]) => [x, y - swell * 30] as Point), [river, swell]);
  const riverPath = river ? `${pathFrom(northRaised)} L${reversePath(river.south_bank).slice(1)} Z` : '';

  const lostByZone: Record<string, number> = {};
  for (const [zid, z] of Object.entries(state?.zones || {})) lostByZone[zid] = z.lost;

  return (
    <div className={`scene-wrap phase-${s.phase} status-${status}${reduced ? ' reduced' : ''}`} data-testid="scene" style={{ background: landDark }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="scene-title scene-desc" className="scene" preserveAspectRatio="xMidYMid meet">
        <title id="scene-title">Village map</title>
        <desc id="scene-desc">{sceneDescription(s, layout)}</desc>
        <defs>
          <SceneDefs reduced={reduced} land={land} landDark={landDark} />
          <pattern id="hatch-warn" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#E69F00" strokeWidth="3" />
          </pattern>
          <pattern id="hatch-danger" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 0L10 10M10 0L0 10" stroke="#D55E00" strokeWidth="2.5" />
          </pattern>
          <pattern id="deep-water" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M0 6 Q3 3 6 6 T12 6" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.5" />
          </pattern>
          <symbol id="house" viewBox="-12 -12 24 24">
            <rect x="-9" y="-1" width="18" height="11" fill="#f7f1e3" stroke="#5b4636" strokeWidth="1.5" />
            <path d="M-11 0 L0 -10 L11 0 Z" fill="url(#fg-roof)" stroke="#5b2f1a" strokeWidth="1.5" strokeLinejoin="round" />
            <rect x="-2.5" y="3" width="5" height="7" fill="#8a6a4f" />
            <rect x="-7.5" y="2" width="3.5" height="3.5" fill="#bcd7ea" stroke="#5b4636" strokeWidth="0.6" />
            <rect x="4" y="2" width="3.5" height="3.5" fill="#bcd7ea" stroke="#5b4636" strokeWidth="0.6" />
          </symbol>
          <symbol id="boat" viewBox="-16 -9 32 18">
            <path d="M-15 -2 H15 L10 7 H-10 Z" fill="#0072B2" stroke="#023858" strokeWidth="1.5" />
            <circle cx="-5" cy="-5" r="3" fill="#f7f3ea" /><circle cx="2" cy="-5" r="3" fill="#f7f3ea" /><circle cx="9" cy="-5" r="3" fill="#CC79A7" />
          </symbol>
          <symbol id="truck" viewBox="-16 -10 32 20">
            <rect x="-15" y="-7" width="20" height="12" fill="#E69F00" stroke="#5b3a00" strokeWidth="1.5" />
            <rect x="5" y="-3" width="9" height="8" fill="#F0E442" stroke="#5b3a00" strokeWidth="1.5" />
            <circle cx="-9" cy="7" r="3" fill="#222" /><circle cx="8" cy="7" r="3" fill="#222" />
          </symbol>
        </defs>

        {/* Land, hills, trees */}
        <rect width={W} height={H} fill="url(#fg-land)" />
        <rect width={W} height={H} fill="url(#fg-grain)" />
        {(layout.decor?.hills || []).map(([x, y], i) => (
          <g key={`h${i}`}>
            <ellipse cx={x + 6} cy={y + 8} rx="92" ry="40" fill="#000" opacity="0.08" />
            <ellipse cx={x} cy={y} rx="90" ry="40" fill={terrain === 'mountain' ? '#a9b892' : '#c7d9a6'} />
            <ellipse cx={x - 18} cy={y - 10} rx="50" ry="18" fill="#ffffff" opacity="0.14" />
          </g>
        ))}
        <Landforms layout={layout} s={s} layer="back" />
        <Decor layout={layout} s={s} reduced={reduced} layer="under" />
        {(layout.decor?.trees || []).map(([x, y], i) => <Tree key={`t${i}`} x={x} y={y} i={i} pine={terrain === 'mountain'} />)}

        {/* Roads */}
        {layout.routes.map((r) => {
          const z = s.zones[r.zone_id];
          const d = pathFrom(r.waypoints);
          return (
            <g key={`road-${r.zone_id}`} data-testid={`route-${r.zone_id}`}>
              <path d={d} fill="none" stroke="#c8b48f" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
              <path d={d} fill="none" stroke="#fffaf0" strokeWidth="2" strokeDasharray="8 8" />
              {z?.road_flooded && (
                <g data-testid={`road-flooded-${r.zone_id}`}>
                  <path d={pathFrom(r.waypoints.slice(0, 2))} fill="none" stroke="#0072B2" strokeWidth="11" strokeDasharray="10 6" strokeOpacity="0.85" />
                  <RoadSign at={pointAt(r.waypoints.slice(0, 2), 0.6)} label="Road flooded" />
                </g>
              )}
              {z?.road_blocked && !z.road_flooded && (
                <g data-testid={`road-blocked-${r.zone_id}`}>
                  <Debris at={pointAt(r.waypoints, 0.08)} />
                  <RoadSign at={pointAt(r.waypoints.slice(0, 2), 0.6)} label="Debris" />
                </g>
              )}
            </g>
          );
        })}

        {/* River with swelling water and status outline */}
        {river && (
          <g data-testid="river" className={`river river-${status}`}>
            <path d={riverPath} fill={isSea ? 'url(#fg-sea)' : 'url(#fg-water)'} />
            <path d={riverPath} fill="url(#fg-shimmer)" />
            <path d={pathFrom(northRaised)} fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="7" strokeDasharray="3 14" strokeLinecap="round" className="shore-foam" />
            {status !== 'normal' && (
              <path d={riverPath} fill={`url(#hatch-${status === 'danger' ? 'danger' : 'warn'})`} opacity="0.35" />
            )}
            <path d={pathFrom(northRaised)} fill="none" stroke={status === 'danger' ? '#D55E00' : status === 'warning' ? '#E69F00' : '#0072B2'} strokeWidth="4" />
            <path d={pathFrom(river.center_path)} fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2" strokeDasharray="14 22" className="river-flow" />
          </g>
        )}

        <Landforms layout={layout} s={s} layer="over-water" />
        <Decor layout={layout} s={s} reduced={reduced} layer="over" />

        {/* Embankment */}
        <g data-testid="embankment" className={s.embankment_breached ? 'embankment breached' : 'embankment'}>
          {(layout.embankment?.segments || []).map((seg, i, all) => {
            const breachHere = s.embankment_breached && i === Math.floor(all.length / 2);
            if (breachHere) {
              const a = seg.start, b = seg.end;
              const m1: Point = [a[0] + (b[0] - a[0]) * 0.38, a[1] + (b[1] - a[1]) * 0.38];
              const m2: Point = [a[0] + (b[0] - a[0]) * 0.62, a[1] + (b[1] - a[1]) * 0.62];
              return (
                <g key={seg.id} data-testid="breach">
                  <path d={pathFrom([a, m1])} stroke="#8a5a2b" strokeWidth="10" strokeLinecap="round" />
                  <path d={pathFrom([m2, b])} stroke="#8a5a2b" strokeWidth="10" strokeLinecap="round" />
                  <path d={`M${m1[0]} ${m1[1]} Q${(m1[0] + m2[0]) / 2} ${m1[1] - 70} ${m2[0]} ${m2[1]} Z`} fill="#56B4E9" opacity="0.8" />
                  <text x={(m1[0] + m2[0]) / 2} y={m1[1] - 22} className="svg-label danger" textAnchor="middle">BREACH</text>
                </g>
              );
            }
            return <path key={seg.id} d={pathFrom([seg.start, seg.end])} stroke="#8a5a2b" strokeWidth="10" strokeLinecap="round" />;
          })}
          {!s.embankment_breached && Array.from({ length: Math.min(4, Math.floor((100 - s.embankment_integrity) / 20)) }, (_, i) => {
            const segs = layout.embankment?.segments || [];
            const seg = segs[(i + 1) % Math.max(1, segs.length)];
            if (!seg) return null;
            const [x, y] = pointAt([seg.start, seg.end], 0.3 + 0.15 * i);
            return <path key={`crack${i}`} data-testid="crack" d={`M${x - 6} ${y - 6} l4 4 l-3 3 l5 5`} stroke="#2b1a0b" strokeWidth="2" fill="none" />;
          })}
        </g>

        {/* Zones: water, houses, people */}
        {layout.zones.map((z) => {
          const zs = s.zones[z.id];
          if (!zs) return null;
          const depthFrac = clamp01(zs.water_depth_cm / 200);
          const atHome = zs.population_remaining - zs.vulnerable_remaining;
          const dots = dotGrid(z.x + 10, z.y + z.height - 30, z.width - 20, Math.ceil(Math.max(0, atHome) / 10));
          const vdots = dotGrid(z.x + 10, z.y + 26, z.width - 20, Math.ceil(zs.vulnerable_remaining / 10), 16);
          return (
            <g key={z.id} data-testid={`zone-${z.id}`} className="zone">
              <rect x={z.x + 3} y={z.y + 5} width={z.width} height={z.height} rx="12" fill="#000" opacity="0.1" />
              <rect x={z.x} y={z.y} width={z.width} height={z.height} rx="12" fill="#f4eedb" stroke="#7b6a52" strokeWidth="2" />
              <rect x={z.x + 4} y={z.y + 4} width={z.width - 8} height={z.height - 8} rx="9" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeDasharray="2 5" />
              {zs.water_depth_cm > 0 && (
                <g data-testid={`zone-water-${z.id}`}>
                  <rect x={z.x} y={z.y + z.height * (1 - Math.max(0.25, depthFrac))} width={z.width}
                    height={z.height * Math.max(0.25, depthFrac)} rx="8" fill="url(#fg-flood)" opacity={0.5 + 0.4 * depthFrac} className="zone-water" />
                  <rect x={z.x} y={z.y + z.height * (1 - Math.max(0.25, depthFrac))} width={z.width}
                    height={z.height * Math.max(0.25, depthFrac)} rx="8" fill="url(#fg-shimmer)" className="zone-water" />
                  {zs.water_depth_cm >= 150 && (
                    <rect x={z.x} y={z.y} width={z.width} height={z.height} rx="8" fill="url(#deep-water)" />
                  )}
                </g>
              )}
              <g filter="url(#fg-shadow)">
                {z.house_points.map(([hx, hy], i) => (
                  <use key={i} href="#house" x={hx - 12} y={hy - 12} width="24" height="24"
                    className={inRecovery && rec?.power_on && zs.returned > 0 ? 'house lit' : 'house'} />
                ))}
              </g>
              {night > 0.35 && zs.water_depth_cm < 60 && (zs.population_remaining > 0 || (inRecovery && !!rec?.power_on && zs.returned > 0)) && (
                <g aria-hidden="true" opacity={Math.min(1, (night - 0.3) * 2.2)}>
                  {z.house_points.map(([hx, hy], i) => (
                    <circle key={i} cx={hx} cy={hy + 3} r="9" fill="url(#fg-glow)" className="window-glow" style={{ animationDelay: `${(i % 5) * 0.37}s` }} />
                  ))}
                </g>
              )}
              {dots.map(([x, y], i) => <circle key={`p${i}`} cx={x} cy={y} r="4.5" className="person" />)}
              {vdots.map(([x, y], i) => (
                <g key={`v${i}`} className="person-vulnerable" transform={`translate(${x} ${y})`}>
                  <circle r="6.5" fill="#ffffff" stroke="#CC79A7" strokeWidth="2.5" /><circle r="2.5" fill="#CC79A7" />
                </g>
              ))}
              <text x={z.x + 8} y={z.y - 8} className="svg-label">{z.name.replace(/ \(.*\)/, '')}</text>
              {zs.water_depth_cm > 0 && (
                <text x={z.x + z.width - 6} y={z.y + 20} textAnchor="end" className="svg-label water">{zs.water_depth_cm} cm</text>
              )}
              {zs.evacuation_ordered && <Flag at={[z.x + z.width - 14, z.y + 4]} />}
              {zs.surveyed && <text x={z.x + z.width - 8} y={z.y + z.height - 8} textAnchor="end" className="svg-label small">surveyed</text>}
              {(lostByZone[z.id] || 0) > 0 && (
                <text x={z.x + 8} y={z.y + z.height + 20} className="svg-label small muted" data-testid={`lost-${z.id}`}>
                  {lostByZone[z.id]} people lost
                </text>
              )}
            </g>
          );
        })}

        {/* Shelter */}
        {layout.shelters.map((sh, si) => {
          const occ = si === 0 ? s.shelter.occupancy : 0;
          const dots = dotGrid(sh.x + 8, sh.y + 26, sh.width - 16, Math.ceil(occ / 10), 10);
          return (
            <g key={sh.id} data-testid={si === 0 ? 'shelter' : `shelter-${sh.id}`} className={s.shelter.is_open ? 'shelter open' : 'shelter closed'}>
              <path d={`M${sh.x - 6} ${sh.y + 14} L${sh.x + sh.width / 2} ${sh.y - 14} L${sh.x + sh.width + 6} ${sh.y + 14} Z`} fill="#b45f3c" />
              <rect x={sh.x} y={sh.y + 12} width={sh.width} height={sh.height} rx="4" fill={s.shelter.is_open ? '#fff7d6' : '#d9d4c7'} stroke="#5b4636" strokeWidth="2" />
              {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#009E73" />)}
              {si === 0 ? (<>
                <rect x={sh.x} y={sh.y + sh.height + 18} width={sh.width} height="8" rx="4" fill="#e6e1d3" />
                <rect x={sh.x} y={sh.y + sh.height + 18} width={sh.width * clamp01(occ / Math.max(1, s.shelter.capacity))} height="8" rx="4" fill="#009E73" />
                <text x={sh.x + sh.width / 2} y={sh.y + sh.height + 44} textAnchor="middle" className="svg-label small">
                  {s.shelter.is_open ? `${layout.shelters.length > 1 ? 'Shelters' : 'Shelter'} ${occ}/${s.shelter.capacity}` : 'Shelter closed'}
                </text></>) : (
                <text x={sh.x + sh.width / 2} y={sh.y + sh.height + 34} textAnchor="middle" className="svg-label tiny">{sh.name}</text>)}
            </g>
          );
        })}

        {/* Recovery sites */}
        {inRecovery && rec && <RecoverySites layout={layout} s={s} />}

        {/* Moving transport with people */}
        {!inRecovery && layout.routes.map((r) => {
          const zs = s.zones[r.zone_id];
          if (!zs) return null;
          const items: { kind: 'boat' | 'truck'; n: number }[] = [];
          if (zs.boats_assigned > 0) items.push({ kind: 'boat', n: zs.boats_assigned });
          if (zs.vehicles_assigned > 0 && !zs.road_flooded) items.push({ kind: 'truck', n: zs.vehicles_assigned });
          return items.map((it, k) => {
            const d = pathFrom(r.waypoints);
            const [sx, sy] = pointAt(r.waypoints, 0.35 + 0.2 * k);
            return (
              <g key={`${r.zone_id}-${it.kind}`} data-testid={`${it.kind}-${r.zone_id}`}>
                {reduced ? (
                  <use href={`#${it.kind}`} x={sx - 16} y={sy - 10} width="32" height="20" />
                ) : (
                  <g>
                    <use href={`#${it.kind}`} x="-16" y="-10" width="32" height="20" />
                    <animateMotion dur={`${7 + k}s`} repeatCount="indefinite" path={d} keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" />
                  </g>
                )}
                <text x={sx + 18} y={sy - 10} className="svg-label small">×{it.n}</text>
              </g>
            );
          });
        })}

        <CloudShadows W={W} H={H} s={s} reduced={reduced} />
        {/* Rain */}
        <Rain W={W} H={H} amount={rain} reduced={reduced} wind={isSea ? 1.6 : s.phase === 'flood' ? 1.0 : 0.5} />

        {/* Light: dusk and night as the peak nears, clearing for recovery */}
        <rect width={W} height={H} fill="#f39c4a" opacity={0.16 * Math.sin(Math.PI * clamp01(night / 0.65))} pointerEvents="none" className="light-layer" />
        <rect width={W} height={H} fill="#13213f" opacity={night * 0.55} pointerEvents="none" data-testid="night" className="light-layer" />
        <ShelterGlow layout={layout} open={s.shelter.is_open} night={night} />
        <Stars W={W} night={night} />
        <Lightning W={W} H={H} active={s.phase === 'flood' && status === 'danger'} reduced={reduced} />
        <RecoveryJoy W={W} s={s} reduced={reduced} />
        <rect width={W} height={H} fill="url(#fg-vignette)" pointerEvents="none" />
        <g transform="translate(940 34)" aria-hidden="true">
          {night < 0.35
            ? <g><circle r="16" fill="#F0E442" stroke="#b8a600" /></g>
            : <path d="M6 -16 A16 16 0 1 0 6 16 A12 12 0 1 1 6 -16" fill="#f7f3ea" />}
        </g>

        {/* River gauge */}
        <Gauge s={s} status={status} label={layout.water_body === 'sea' ? 'Sea' : layout.water_body === 'canal' ? 'Canal' : 'River'} />
        <ResourceCluster layout={layout} s={s} />

        <EventEffects layout={layout} items={fx} reduced={reduced} />
      </svg>
      {replaying && <div className="replay-badge" role="status">Replay</div>}
    </div>
  );
};

const Flag: React.FC<{ at: Point }> = ({ at: [x, y] }) => (
  <g transform={`translate(${x} ${y})`} aria-hidden="true">
    <line x1="0" y1="0" x2="0" y2="22" stroke="#333" strokeWidth="2" />
    <path d="M0 0 L14 5 L0 10 Z" fill="#D55E00" />
  </g>
);

const RoadSign: React.FC<{ at: Point; label: string }> = ({ at: [x, y], label }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="-34" y="-26" width="68" height="18" rx="3" fill="#ffffff" stroke="#D55E00" strokeWidth="2" />
    <text y="-13" textAnchor="middle" className="svg-label tiny">{label}</text>
  </g>
);

const Debris: React.FC<{ at: Point }> = ({ at: [x, y] }) => (
  <g transform={`translate(${x} ${y})`} aria-hidden="true">
    <path d="M-12 4 L-4 -6 L2 2 Z" fill="#7a5230" /><path d="M0 6 L8 -4 L12 6 Z" fill="#5b3a1e" /><rect x="-6" y="-2" width="14" height="4" fill="#8f6a44" transform="rotate(20)" />
  </g>
);

const Gauge: React.FC<{ s: Summary; status: string; label: string }> = ({ s, status, label }) => {
  const top = 70, bottom = 300, min = 100, max = 520;
  const y = (cm: number) => bottom - ((cm - min) / (max - min)) * (bottom - top);
  return (
    <g data-testid="gauge" transform="translate(18 0)">
      <rect x="0" y={top} width="26" height={bottom - top} rx="6" fill="#ffffff" stroke="#4b5563" strokeWidth="2" />
      <rect x="3" y={y(s.water_level_cm)} width="20" height={Math.max(0, bottom - y(s.water_level_cm) - 3)} rx="4"
        fill={status === 'danger' ? '#D55E00' : status === 'warning' ? '#E69F00' : '#0072B2'} />
      {status !== 'normal' && (
        <rect x="3" y={y(s.water_level_cm)} width="20" height={Math.max(0, bottom - y(s.water_level_cm) - 3)} rx="4" fill="url(#deep-water)" />
      )}
      <line x1="-4" x2="30" y1={y(s.warning_level_cm)} y2={y(s.warning_level_cm)} stroke="#E69F00" strokeWidth="3" strokeDasharray="4 3" />
      <line x1="-4" x2="30" y1={y(s.danger_level_cm)} y2={y(s.danger_level_cm)} stroke="#D55E00" strokeWidth="3" />
      <text x="34" y={y(s.danger_level_cm) + 5} className="svg-label tiny">danger</text>
      <text x="34" y={y(s.warning_level_cm) + 5} className="svg-label tiny">warning</text>
      <text x="13" y={bottom + 24} textAnchor="middle" className="svg-label small">{s.water_level_cm} cm</text>
      <text x="13" y={top - 10} textAnchor="middle" className="svg-label tiny">{label}</text>
    </g>
  );
};

const RecoverySites: React.FC<{ layout: Layout; s: Summary }> = ({ layout, s }) => {
  const rec = s.recovery!;
  const get = (k: string) => layout.recovery_sites?.[k];
  const wp = get('water_point'), mc = get('medical_camp'), ss = get('substation'), hc = get('health_centre'), sd = get('supply_depot');
  return (
    <g data-testid="recovery-sites">
      {wp && (
        <g transform={`translate(${wp.x} ${wp.y})`} data-testid="site-water_point" className={rec.clean_water_active ? 'site on' : 'site off'}>
          <circle r="18" fill={rec.clean_water_active ? '#56B4E9' : '#eeeeee'} stroke="#0072B2" strokeWidth="2" strokeDasharray={rec.clean_water_active ? undefined : '4 3'} />
          <path d="M0 -10 C6 -2 8 2 8 5 A8 8 0 0 1 -8 5 C-8 2 -6 -2 0 -10Z" fill={rec.clean_water_active ? '#ffffff' : '#9ca3af'} />
          <text y="34" textAnchor="middle" className="svg-label tiny">{rec.clean_water_active ? 'Clean water' : 'No clean water'}</text>
        </g>
      )}
      {mc && (
        <g transform={`translate(${mc.x} ${mc.y})`} data-testid="site-medical_camp" className={rec.medical_camp_active ? 'site on' : 'site off'}>
          <path d="M-22 14 L0 -16 L22 14 Z" fill={rec.medical_camp_active ? '#009E73' : '#eeeeee'} stroke="#04634a" strokeWidth="2" strokeDasharray={rec.medical_camp_active ? undefined : '4 3'} />
          {rec.medical_camp_active && <path d="M-9 4 h5 l3 -7 l4 12 l3 -5 h5" fill="none" stroke="#ffffff" strokeWidth="2.5" />}
          <text y="30" textAnchor="middle" className="svg-label tiny">{rec.medical_camp_active ? 'Medical camp' : 'No camp yet'}</text>
        </g>
      )}
      {ss && (
        <g transform={`translate(${ss.x} ${ss.y})`} data-testid="site-substation" className={rec.power_on ? 'site on' : 'site off'}>
          <rect x="-18" y="-16" width="36" height="32" rx="4" fill={rec.power_on ? '#F0E442' : '#6b7280'} stroke="#333" strokeWidth="2" />
          <path d="M3 -12 L-7 2 H0 L-3 12 L8 -3 H1 Z" fill={rec.power_on ? '#333' : '#d1d5db'} />
          <text y="32" textAnchor="middle" className="svg-label tiny">{rec.power_on ? 'Power on' : 'Power off'}</text>
        </g>
      )}
      {hc && (
        <g transform={`translate(${hc.x} ${hc.y})`} data-testid="site-health_centre" className={rec.health_centre_open ? 'site on' : 'site off'}>
          <rect x="-20" y="-14" width="40" height="28" fill="#f7f3ea" stroke="#5b4636" strokeWidth="2" />
          {[-12, 0, 12].map((x) => <rect key={x} x={x - 3} y="-7" width="6" height="7" fill={rec.health_centre_open ? '#F0E442' : '#4b5563'} />)}
          <text y="30" textAnchor="middle" className="svg-label tiny">{rec.health_centre_open ? 'Health centre open' : 'Health centre closed'}</text>
        </g>
      )}
      {sd && (
        <g transform={`translate(${sd.x} ${sd.y})`} data-testid="site-supply_depot">
          {Array.from({ length: rec.supply_deliveries_left }, (_, i) => (
            <rect key={i} x={-20 + i * 14} y="-10" width="12" height="12" fill="#c8a165" stroke="#5b3a1e" />
          ))}
          <text y="22" textAnchor="middle" className="svg-label tiny">Depot</text>
        </g>
      )}
    </g>
  );
};

/** Scenario decor: dam, city blocks, railway, underpass, bridges, jetty, fishing boats at sea. Presentational only. */
const Decor: React.FC<{ layout: Layout; s: Summary; reduced: boolean; layer: 'under' | 'over' }> = ({ layout, s, reduced, layer }) => {
  const d = layout.decor || {};
  const mech = s.mechanic;
  if (layer === 'under') {
    return (
      <g data-testid="decor" aria-hidden="true">
        {(d.buildings || []).map(([x, y], i) => (
          <g key={`b${i}`} transform={`translate(${x} ${y})`}>
            <rect x="-22" y={-30 - (i % 3) * 10} width="44" height={52 + (i % 3) * 10} fill="#9aa6b8" stroke="#4b5563" strokeWidth="1.5" />
            {[0, 1, 2].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={-14 + c * 18} y={-22 - (i % 3) * 10 + r * 14} width="9" height="7" fill={mech?.power_down ? '#4b5563' : '#F0E442'} opacity="0.75" />))}
          </g>
        ))}
        {(d.railway || []).length > 1 && (
          <g data-testid="railway">
            <path d={pathFrom(d.railway!)} stroke="#4b5563" strokeWidth="8" fill="none" />
            <path d={pathFrom(d.railway!)} stroke="#e5e7eb" strokeWidth="5" strokeDasharray="2 8" fill="none" />
          </g>
        )}
      </g>
    );
  }
  return (
    <g data-testid="decor-over" aria-hidden="true">
      {(d.underpasses || []).map((u, i) => (
        <g key={`u${i}`} transform={`translate(${u.x} ${u.y})`} data-testid="underpass">
          <path d="M-26 10 v-12 a26 18 0 0 1 52 0 v12" fill="#374151" stroke="#111827" strokeWidth="2" />
          <text y="26" textAnchor="middle" className="svg-label tiny">{u.label || 'Underpass'}</text>
        </g>
      ))}
      {(d.bridges || []).map((b, i) => (
        <g key={`br${i}`} transform={`translate(${b.x} ${b.y})`}>
          <rect x="-34" y="-7" width="68" height="14" rx="3" fill="#a3896b" stroke="#5b4636" strokeWidth="2" />
          {b.label && <text y="-12" textAnchor="middle" className="svg-label tiny">{b.label}</text>}
        </g>
      ))}
      {d.dam && (
        <g transform={`translate(${d.dam.x} ${d.dam.y})`} data-testid="dam">
          <path d="M-30 -40 L20 -30 L20 40 L-30 50 Z" fill="#9ca3af" stroke="#374151" strokeWidth="2.5" />
          {[0, 1, 2].map((i) => <rect key={i} x="10" y={-18 + i * 16} width="10" height="8" fill={mech && s.tick >= (mech.release_tick ?? 999) ? '#56B4E9' : '#4b5563'} />)}
          <text y="66" textAnchor="middle" className="svg-label tiny">{d.dam.label || 'Dam'}</text>
        </g>
      )}
      {d.jetty && (
        <g transform={`translate(${d.jetty.x} ${d.jetty.y})`}>
          <rect x="-26" y="-6" width="52" height="12" fill="#8a6a4f" />
          <text y="26" textAnchor="middle" className="svg-label tiny">{d.jetty.label || 'Depot'}</text>
        </g>
      )}
      {d.sea_boats && mech && mech.boats_at_sea > 0 && (
        <g transform={`translate(${d.sea_boats.x} ${d.sea_boats.y})`} data-testid="sea-boats">
          {Array.from({ length: Math.min(6, mech.boats_at_sea) }, (_, i) => (
            <g key={i} transform={`translate(${(i % 3) * 38 - 38} ${Math.floor(i / 3) * 18 - 10})`} className={reduced ? '' : 'bob'}>
              <path d="M-12 0 h24 l-6 7 h-12z" fill="#E69F00" stroke="#5b3a00" /><line x1="0" y1="0" x2="0" y2="-12" stroke="#333" strokeWidth="1.5" />
            </g>
          ))}
          <text y="34" textAnchor="middle" className="svg-label tiny">{mech.boats_at_sea} boats at sea</text>
        </g>
      )}
    </g>
  );
};

/** Free boats, trucks and sandbags at the depot; an icon greys out at zero. */
const ResourceCluster: React.FC<{ layout: Layout; s: Summary }> = ({ layout, s }) => {
  const j = layout.decor?.jetty || { x: 120, y: 435 };
  const items = [
    { id: 'boats', n: s.transport.boats_available, sym: '#boat' },
    { id: 'trucks', n: s.transport.vehicles_available, sym: '#truck' },
  ];
  return (
    <g transform={`translate(${j.x - 40} ${j.y + 52})`} data-testid="resources" aria-hidden="true">
      <rect x="-10" y="-16" width="132" height="32" rx="8" fill="#ffffff" opacity="0.85" stroke="#4b5563" />
      {items.map((it, i) => (
        <g key={it.id} transform={`translate(${i * 44 + 8} 0)`} className={it.n ? 'res' : 'res depleted'} data-testid={`res-${it.id}${it.n ? '' : '-empty'}`}>
          <use href={it.sym} x="-8" y="-9" width="24" height="16" />
          <text x="22" y="5" className="svg-label tiny">{it.n}</text>
        </g>
      ))}
      <g transform="translate(96 0)" className={(s.sandbags ?? 0) ? 'res' : 'res depleted'} data-testid={`res-sandbags${(s.sandbags ?? 0) ? '' : '-empty'}`}>
        <rect x="-8" y="-6" width="12" height="8" rx="2" fill="#c8a165" stroke="#5b3a1e" />
        <text x="8" y="5" className="svg-label tiny">{s.sandbags ?? 0}</text>
      </g>
    </g>
  );
};
