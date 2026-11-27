// Atmosphere for the map: shared gradients and filters, terrain texture, landforms (islands,
// mountains, glacial lake), drifting cloud shadows, wind-blown rain with splashes, lightning near
// the peak, stars and warm window light at night, a rainbow and birds when recovery begins.
// Purely presentational: nothing here changes what the engine decides.
import React, { useMemo } from 'react';
import type { Layout, Summary } from '../../api/types';
import { tr } from '../../lib/i18n';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Shared <defs>: gradients, patterns and soft-shadow filter used across the scene. */
export const SceneDefs: React.FC<{ reduced: boolean; land: string; landDark: string }> = ({ reduced, land, landDark }) => (
  <>
    <radialGradient id="fg-land" cx="55%" cy="35%" r="85%">
      <stop offset="0" stopColor={land} /><stop offset="1" stopColor={landDark} />
    </radialGradient>
    <linearGradient id="fg-water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#7cc8ef" /><stop offset="0.55" stopColor="#3b9bd6" /><stop offset="1" stopColor="#1d6fa8" />
    </linearGradient>
    <linearGradient id="fg-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#3d8fc7" /><stop offset="1" stopColor="#0b4a7a" />
    </linearGradient>
    <linearGradient id="fg-flood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#7d9fb8" /><stop offset="1" stopColor="#4f7590" />
    </linearGradient>
    <radialGradient id="fg-vignette" cx="50%" cy="50%" r="75%">
      <stop offset="0.6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.35" />
    </radialGradient>
    <radialGradient id="fg-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stopColor="#ffd77a" stopOpacity="0.9" /><stop offset="1" stopColor="#ffd77a" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="fg-cloud" cx="50%" cy="50%" r="50%">
      <stop offset="0" stopColor="#0d1b2a" stopOpacity="0.32" /><stop offset="1" stopColor="#0d1b2a" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="fg-roof" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#d4744a" /><stop offset="1" stopColor="#9c4a2a" />
    </linearGradient>
    <linearGradient id="fg-snow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#c9d6e6" />
    </linearGradient>
    <linearGradient id="fg-rock" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#8592a6" /><stop offset="1" stopColor="#4a5568" />
    </linearGradient>
    <pattern id="fg-shimmer" width="60" height="22" patternUnits="userSpaceOnUse">
      <path d="M0 11 Q15 5 30 11 T60 11" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.6" />
      <path d="M10 19 Q20 15 30 19" fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.2" />
      {!reduced && <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="60 0" dur="6s" repeatCount="indefinite" />}
    </pattern>
    <pattern id="fg-grain" width="140" height="140" patternUnits="userSpaceOnUse">
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={(i * 53) % 140} cy={(i * 97) % 140} r={1 + (i % 3) * 0.6} fill={i % 2 ? '#ffffff' : '#3d5a2a'} opacity={0.07} />
      ))}
    </pattern>
    <filter id="fg-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="2" dy="3" stdDeviation="2" floodColor="#1b2a10" floodOpacity="0.35" />
    </filter>
    <filter id="fg-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
  </>
);

/** Islands, mountains and glacial lake from the scenario decor. */
export const Landforms: React.FC<{ layout: Layout; s: Summary; layer: 'back' | 'over-water' }> = ({ layout, s, layer }) => {
  const d = layout.decor || {};
  if (layer === 'back') {
    return (
      <g aria-hidden="true" data-testid="landforms">
        {(d.peaks || []).map(([x, y, size], i) => (
          <g key={`pk${i}`} transform={`translate(${x} ${y})`} filter="url(#fg-shadow)">
            <path d={`M${-size} ${size * 0.9} L0 0 L${size} ${size * 0.9} Z`} fill="url(#fg-rock)" />
            <path d={`M${-size * 0.32} ${size * 0.29} L0 0 L${size * 0.32} ${size * 0.29} L${size * 0.14} ${size * 0.24} L0 ${size * 0.32} L${-size * 0.16} ${size * 0.22} Z`} fill="url(#fg-snow)" />
            <path d={`M0 0 L${size} ${size * 0.9} H${size * 0.2} Z`} fill="#000" opacity="0.12" />
          </g>
        ))}
        {d.lake && (
          <g transform={`translate(${d.lake.x} ${d.lake.y})`} data-testid="glacial-lake">
            <path d="M-70 -42 Q-20 -70 40 -48 L30 -30 Q-10 -44 -60 -28Z" fill="url(#fg-snow)" opacity="0.95" />
            <ellipse rx="64" ry="24" fill="url(#fg-water)" stroke="#e0f4ff" strokeWidth="3" />
            <ellipse rx="64" ry="24" fill="url(#fg-shimmer)" />
            <path d="M48 12 q14 10 26 30" stroke="#7a6a58" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.85" />
            <text y="44" textAnchor="middle" className="svg-label tiny">{d.lake.label || tr('Glacial lake')}</text>
            {s.phase !== 'before' && <text y="-52" textAnchor="middle" className="svg-label tiny danger">{tr('Outburst')}</text>}
          </g>
        )}
      </g>
    );
  }
  // Islands sit on top of the river; they shrink as the water rises.
  const swell = clamp01((s.water_level_cm - s.normal_level_cm) / Math.max(1, s.crest_level_cm - s.normal_level_cm));
  return (
    <g aria-hidden="true" data-testid="islands">
      {(d.islands || []).map(([cx, cy, rx, ry], i) => (
        <g key={`is${i}`}>
          <ellipse cx={cx} cy={cy} rx={rx * (1 - swell * 0.06)} ry={ry * (1 - swell * 0.12)} fill="#e8d9a8" />
          <ellipse cx={cx} cy={cy - 4} rx={rx * (0.92 - swell * 0.06)} ry={ry * (0.82 - swell * 0.12)} fill="url(#fg-land)" />
          <ellipse cx={cx} cy={cy - 4} rx={rx * (0.92 - swell * 0.06)} ry={ry * (0.82 - swell * 0.12)} fill="url(#fg-grain)" />
          <ellipse cx={cx} cy={cy} rx={rx * (1 - swell * 0.06)} ry={ry * (1 - swell * 0.12)} fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="10 8" className="shore-foam" />
        </g>
      ))}
    </g>
  );
};

/** Tree with a soft shadow; pines in the mountains. */
export const Tree: React.FC<{ x: number; y: number; i: number; pine?: boolean; flooded?: boolean }> = ({ x, y, i, pine, flooded }) => {
  const sc = 0.85 + ((i * 37) % 30) / 100;
  if (pine) {
    return (
      <g transform={`translate(${x} ${y}) scale(${sc})`} filter="url(#fg-shadow)">
        <path d="M0 -26 L13 0 H-13Z" fill="#2f5d3a" /><path d="M0 -16 L16 10 H-16Z" fill="#3a7046" />
        <rect x="-2" y="10" width="4" height="6" fill="#5b4636" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${sc})`} filter="url(#fg-shadow)" className={flooded ? 'tree flooded' : 'tree'}>
      <circle r="14" fill="#5f8f3e" /><circle r="10" cx="-6" cy="-5" fill="#7fb055" /><circle r="7" cx="6" cy="-7" fill="#93c46a" />
      <circle r="3" cx="-8" cy="-9" fill="#b6dd8a" opacity="0.8" />
    </g>
  );
};

/** Cloud shadows drift over the land before and during the flood. */
export const CloudShadows: React.FC<{ W: number; H: number; s: Summary; reduced: boolean }> = ({ W, H, s, reduced }) => {
  if (s.phase === 'recovery') return null;
  const n = s.phase === 'flood' ? 5 : 3;
  return (
    <g aria-hidden="true" pointerEvents="none" className="cloud-shadows">
      {Array.from({ length: n }, (_, i) => (
        <ellipse key={i} cx={(i * 290) % W} cy={80 + ((i * 173) % (H - 160))} rx={170 + (i % 3) * 50} ry={70 + (i % 2) * 30}
          fill="url(#fg-cloud)" className={reduced ? '' : 'cloud-drift'} style={{ animationDuration: `${50 + i * 13}s`, animationDelay: `${-i * 11}s` }} />
      ))}
    </g>
  );
};

/** Wind-blown rain with splash rings; heavier during the flood. */
export const Rain: React.FC<{ W: number; H: number; amount: number; reduced: boolean; wind: number }> = ({ W, H, amount, reduced, wind }) => {
  const drops = useMemo(() => Array.from({ length: 160 }, (_, i) => ({
    x: (i * 137) % (W + 80) - 40, y: (i * 89) % H, d: 0.45 + ((i * 7) % 10) / 22, len: 10 + (i % 4) * 4,
  })), [W, H]);
  const splashes = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ x: (i * 211) % W, y: (i * 127) % H })), [W, H]);
  if (amount <= 0) return null;
  const n = Math.round(160 * amount);
  return (
    <g className="rain" aria-hidden="true" pointerEvents="none">
      {drops.slice(0, n).map((r, i) => (
        <line key={i} x1={r.x} y1={r.y} x2={r.x - wind * r.len * 0.6} y2={r.y + r.len} stroke="#cfe3f5" strokeOpacity={0.35 + (i % 3) * 0.12}
          strokeWidth={1.2 + (i % 2) * 0.5} strokeLinecap="round"
          style={{ animationDuration: `${r.d}s`, animationDelay: `${-(i % 10) / 10}s` }} />
      ))}
      {!reduced && splashes.slice(0, Math.round(24 * amount)).map((p, i) => (
        <ellipse key={`s${i}`} cx={p.x} cy={p.y} rx="6" ry="2.2" fill="none" stroke="#e6f3ff" strokeOpacity="0.5" strokeWidth="1"
          className="splash" style={{ animationDelay: `${-(i % 8) * 0.17}s` }} />
      ))}
    </g>
  );
};

/** Occasional lightning when the water is near danger during the flood. */
export const Lightning: React.FC<{ W: number; H: number; active: boolean; reduced: boolean }> = ({ W, H, active, reduced }) => {
  if (!active || reduced) return null;
  return (
    <g aria-hidden="true" pointerEvents="none" data-testid="lightning">
      <rect width={W} height={H} fill="#eef4ff" className="lightning-flash" />
      <path d={`M${W * 0.72} 0 l-22 70 l18 -4 l-30 86 l14 -4 l-24 70`} stroke="#fffbe6" strokeWidth="3.5" fill="none" className="lightning-bolt" strokeLinejoin="round" />
    </g>
  );
};

/** Stars fade in at night. */
export const Stars: React.FC<{ W: number; night: number }> = ({ W, night }) => {
  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ x: (i * 241) % W, y: (i * 61) % 160, r: 0.8 + (i % 3) * 0.5 })), [W]);
  if (night < 0.45) return null;
  return (
    <g aria-hidden="true" pointerEvents="none" opacity={clamp01((night - 0.45) * 3)}>
      {stars.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#fff" className="twinkle" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />)}
    </g>
  );
};

/** Rainbow and birds as recovery begins. */
export const RecoveryJoy: React.FC<{ W: number; s: Summary; reduced: boolean }> = ({ W, s, reduced }) => {
  if (s.phase !== 'recovery') return null;
  const since = s.tick - (s.recovery_start_tick ?? s.tick);
  return (
    <g aria-hidden="true" pointerEvents="none" data-testid="recovery-joy">
      {since <= 3 && (
        <g opacity={0.5 - since * 0.1} transform={`translate(${W * 0.55} 330)`}>
          {['#D55E00', '#E69F00', '#F0E442', '#009E73', '#56B4E9', '#0072B2', '#CC79A7'].map((c, i) => (
            <path key={c} d={`M${-360 + i * 9} 0 A${360 - i * 9} ${300 - i * 9} 0 0 1 ${360 - i * 9} 0`} fill="none" stroke={c} strokeWidth="9" />
          ))}
        </g>
      )}
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d="M-8 0 q4 -6 8 0 q4 -6 8 0" stroke="#24313f" strokeWidth="2" fill="none"
          transform={`translate(${200 + i * 60} ${60 + (i % 2) * 22})`} className={reduced ? '' : 'bird'} style={{ animationDelay: `${-i * 1.7}s` }} />
      ))}
    </g>
  );
};

/** Warm glow of lamps in the open shelter at night. */
export const ShelterGlow: React.FC<{ layout: Layout; open: boolean; night: number }> = ({ layout, open, night }) => {
  if (!open || night < 0.25) return null;
  return (
    <g aria-hidden="true" pointerEvents="none" opacity={clamp01(night * 1.4)}>
      {layout.shelters.map((sh) => (
        <ellipse key={sh.id} cx={sh.x + sh.width / 2} cy={sh.y + sh.height / 2 + 10} rx={sh.width} ry={sh.height} fill="url(#fg-glow)" className="glow-pulse" />
      ))}
    </g>
  );
};
