import React from 'react';

/** FloodGuard mark: a shield holding a water drop over a wave (original artwork). */
export const Logo: React.FC<{ size?: number; title?: string }> = ({ size = 28, title }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
    {title && <title>{title}</title>}
    <defs>
      <linearGradient id="fg-logo-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1E88E5" /><stop offset="1" stopColor="#0B3D6E" />
      </linearGradient>
    </defs>
    <path d="M32 3 L56 11 V30 C56 45 46 55 32 61 C18 55 8 45 8 30 V11 Z" fill="url(#fg-logo-g)" stroke="#F0E442" strokeWidth="3" strokeLinejoin="round" />
    <path d="M32 14 C39 24 43 30 43 36 A11 11 0 0 1 21 36 C21 30 25 24 32 14 Z" fill="#fff" />
    <path d="M14 44 C19 40 24 48 32 44 S45 40 50 44" fill="none" stroke="#56B4E9" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

/** Small hazard illustrations for the scenario cards (hand-drawn inline SVG). */
export const HazardArt: React.FC<{ kind: string }> = ({ kind }) => {
  const sky = kind === 'coast' ? '#3b4a6b' : kind === 'city' ? '#2c3e5c' : kind === 'mountain' ? '#2a3d5c' : '#35557a';
  return (
    <svg viewBox="0 0 320 160" className="hazard-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="160" fill={sky} />
      {kind === 'river' && (<g>
        <path d="M0 50 Q60 20 120 45 T240 40 T320 35 V0 H0Z" fill="#6c8db3" opacity="0.5" />
        <rect y="70" width="320" height="90" fill="#7fa65a" />
        <path d="M0 120 C60 105 120 135 180 118 S280 105 320 118 V160 H0Z" fill="#56B4E9" />
        <path d="M0 116 C60 101 120 131 180 114 S280 101 320 114" stroke="#8a5a2b" strokeWidth="6" fill="none" />
        {[40, 90, 140].map((x) => <path key={x} d={`M${x} 95 l14 -12 l14 12 v14 h-28z`} fill="#f7f3ea" stroke="#5b4636" strokeWidth="2" />)}
        <path d="M240 90 l20 -18 l20 18 v20 h-40z" fill="#fff7d6" stroke="#5b4636" strokeWidth="2" />
      </g>)}
      {kind === 'city' && (<g>
        {[0, 40, 85, 130, 180, 230, 275].map((x, i) => <rect key={x} x={x} y={40 + (i % 3) * 12} width="36" height={90 - (i % 3) * 12} fill="#1f2d44" stroke="#4b6286" />)}
        {[10, 50, 95, 140, 190, 240, 285].map((x) => [56, 72, 88].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" fill="#F0E442" opacity="0.7" />))}
        <rect y="120" width="320" height="40" fill="#56B4E9" opacity="0.85" />
        <path d="M110 120 a40 26 0 0 1 80 0" fill="none" stroke="#94a3b8" strokeWidth="6" />
        {Array.from({ length: 24 }, (_, i) => <line key={i} x1={i * 14} y1={i % 2 ? 10 : 20} x2={i * 14 - 6} y2={(i % 2 ? 10 : 20) + 16} stroke="#cfe5f3" strokeWidth="2" opacity="0.7" />)}
      </g>)}
      {kind === 'dam' && (<g>
        <rect y="60" width="320" height="100" fill="#7fa65a" />
        <path d="M0 60 L80 30 L80 140 L0 140Z" fill="#9ca3af" stroke="#4b5563" strokeWidth="3" />
        <path d="M80 70 C120 80 130 120 180 120 S260 110 320 125 V160 H80Z" fill="#56B4E9" />
        <path d="M82 72 q10 30 22 40" stroke="#ffffff" strokeWidth="4" fill="none" />
        {[200, 250].map((x) => <path key={x} d={`M${x} 92 l14 -12 l14 12 v14 h-28z`} fill="#f7f3ea" stroke="#5b4636" strokeWidth="2" />)}
      </g>)}
      {kind === 'coast' && (<g>
        <path d="M0 0 H320 V80 H0Z" fill="#2b3550" />
        <path d="M230 40 a30 30 0 1 1 -1 0 M230 40 a14 14 0 1 0 1 0" fill="none" stroke="#cbd5e1" strokeWidth="5" />
        <rect y="70" width="320" height="40" fill="#e3d6a8" />
        <path d="M0 105 C40 95 80 115 120 105 S200 95 240 105 S300 115 320 105 V160 H0Z" fill="#0072B2" />
        <path d="M0 105 C40 95 80 115 120 105 S200 95 240 105 S300 115 320 105" stroke="#ffffff" strokeWidth="3" fill="none" />
        {[40, 90].map((x) => <path key={x} d={`M${x} 88 l12 -10 l12 10 v10 h-24z`} fill="#f7f3ea" stroke="#5b4636" strokeWidth="2" />)}
        <path d="M150 128 h40 l-8 8 h-24z" fill="#E69F00" /><line x1="170" y1="128" x2="170" y2="112" stroke="#333" strokeWidth="2" />
      </g>)}
      {kind === 'island' && (<g>
        <path d="M0 40 Q80 25 160 38 T320 34 V0 H0Z" fill="#6c8db3" opacity="0.45" />
        <rect y="46" width="320" height="18" fill="#7fa65a" />
        <rect y="62" width="320" height="98" fill="#4a9fd4" />
        <ellipse cx="165" cy="112" rx="120" ry="30" fill="#e8d9a8" />
        <ellipse cx="165" cy="108" rx="104" ry="22" fill="#9cc274" />
        {[95, 140, 200].map((x) => <path key={x} d={`M${x} 106 l12 -10 l12 10 v10 h-24z`} fill="#f7f3ea" stroke="#5b4636" strokeWidth="2" />)}
        <rect x="236" y="92" width="26" height="14" fill="#c8a165" stroke="#5b3a1e" strokeWidth="2" /><path d="M233 92 l16 -10 l16 10z" fill="#b45f3c" />
        <path d="M40 140 h30 l-6 7 h-18z" fill="#8a5a2b" /><path d="M52 140 v-14 l10 8z" fill="#f7f3ea" />
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M${10 + i * 80} ${75 + (i % 2) * 8} q10 -4 20 0`} stroke="#d6efff" strokeWidth="2" fill="none" />)}
      </g>)}
      {kind === 'mountain' && (<g>
        <path d="M0 110 L60 30 L110 80 L170 12 L240 90 L290 40 L320 70 V160 H0Z" fill="#5b6b82" />
        <path d="M60 30 L75 50 L66 46 L52 52Z M170 12 L192 38 L178 34 L160 42 L158 28Z M290 40 L302 52 L284 54Z" fill="#f4f7fb" />
        <ellipse cx="78" cy="78" rx="34" ry="10" fill="#7cc6e8" stroke="#e0f4ff" strokeWidth="2" />
        <path d="M100 82 C140 100 150 125 200 132 S290 140 320 150 V160 H120 C110 130 100 110 96 86Z" fill="#56B4E9" />
        <path d="M100 84 C130 100 145 120 180 128" stroke="#8a6a4f" strokeWidth="5" fill="none" strokeDasharray="2 6" />
        {[230, 268].map((x) => <path key={x} d={`M${x} 112 l11 -9 l11 9 v10 h-22z`} fill="#f7f3ea" stroke="#5b4636" strokeWidth="2" />)}
        {[20, 40, 300].map((x) => <path key={x} d={`M${x} 150 l7 -18 l7 18z`} fill="#2f5d3a" />)}
      </g>)}
      {kind === 'after' && (<g>
        <rect width="320" height="160" fill="#7ab8e6" />
        <path d="M40 120 A120 120 0 0 1 280 120" fill="none" stroke="#E69F00" strokeWidth="6" opacity="0.7" />
        <path d="M52 120 A108 108 0 0 1 268 120" fill="none" stroke="#F0E442" strokeWidth="6" opacity="0.7" />
        <path d="M64 120 A96 96 0 0 1 256 120" fill="none" stroke="#009E73" strokeWidth="6" opacity="0.7" />
        <path d="M76 120 A84 84 0 0 1 244 120" fill="none" stroke="#56B4E9" strokeWidth="6" opacity="0.7" />
        <rect y="112" width="320" height="48" fill="#8fbf6a" />
        {[60, 120, 210].map((x) => <path key={x} d={`M${x} 118 l14 -12 l14 12 v14 h-28z`} fill="#f7f3ea" stroke="#5b4636" strokeWidth="2" />)}
        <circle cx="270" cy="128" r="10" fill="#56B4E9" /><path d="M270 120 c4 5 5 7 5 9 a5 5 0 0 1 -10 0 c0 -2 1 -4 5 -9z" fill="#fff" />
      </g>)}
    </svg>
  );
};
