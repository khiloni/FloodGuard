// Ambient soundscape synthesised with the Web Audio API: no audio files, nothing downloaded.
// Rain and wind follow the phase and water level; thunder rumbles near the flood peak; birds
// return during recovery; short cues mark good and bad events. Off by default; the player opts in.
import { useEffect, useRef, useState } from 'react';
import type { Phase, SimEvent } from '../api/types';

type Ctx = {
  ac: AudioContext;
  master: GainNode;
  rain: GainNode;
  rainFilter: BiquadFilterNode;
  wind: GainNode;
  windFilter: BiquadFilterNode;
  noise: AudioBuffer;
};

function makeNoise(ac: AudioContext): AudioBuffer {
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1; // pinkish noise (Paul Kellet's economy filter)
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return buf;
}

function loop(c: Ctx, dest: AudioNode) {
  const src = c.ac.createBufferSource();
  src.buffer = c.noise;
  src.loop = true;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  src.connect(dest);
  src.start();
}

function build(): Ctx | null {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  const ac: AudioContext = new AC();
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);
  const noise = makeNoise(ac);

  const rainFilter = ac.createBiquadFilter();
  rainFilter.type = 'highpass';
  rainFilter.frequency.value = 900;
  const rain = ac.createGain();
  rain.gain.value = 0;
  rainFilter.connect(rain).connect(master);

  const windFilter = ac.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 350;
  windFilter.Q.value = 0.7;
  const wind = ac.createGain();
  wind.gain.value = 0;
  windFilter.connect(wind).connect(master);

  const c = { ac, master, rain, rainFilter, wind, windFilter, noise };
  loop(c, rainFilter);
  loop(c, windFilter);
  return c;
}

function thunder(c: Ctx, strength = 1) {
  const t = c.ac.currentTime;
  const src = c.ac.createBufferSource();
  src.buffer = c.noise;
  src.playbackRate.value = 0.35;
  const f = c.ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(600, t);
  f.frequency.exponentialRampToValueAtTime(80, t + 3.5);
  const g = c.ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9 * strength, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
  src.connect(f).connect(g).connect(c.master);
  src.start(t);
  src.stop(t + 4.2);
}

function tone(c: Ctx, freqs: number[], type: OscillatorType, gap = 0.12, vol = 0.12, dur = 0.5) {
  const t0 = c.ac.currentTime;
  freqs.forEach((fr, i) => {
    const o = c.ac.createOscillator();
    o.type = type;
    o.frequency.value = fr;
    const g = c.ac.createGain();
    const t = t0 + i * gap;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  });
}

function bird(c: Ctx) {
  const t = c.ac.currentTime;
  const o = c.ac.createOscillator();
  o.type = 'sine';
  const base = 2200 + Math.random() * 1400;
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.08);
  o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.16);
  const g = c.ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(c.master);
  o.start(t);
  o.stop(t + 0.2);
}

const GOOD = new Set(['shelter_opened', 'warning_issued', 'residents_evacuated', 'vulnerable_evacuated', 'support_arrived',
  'clean_water_provided', 'medical_camp_opened', 'power_restored', 'road_cleared', 'residents_returned', 'fishing_boats_returned',
  'drains_cleared', 'release_staggered', 'illness_treated', 'health_centre_reopened']);
const BAD = new Set(['casualty_occurred', 'embankment_breached', 'fishers_stranded', 'shelter_supplies_exhausted', 'zone_flooded',
  'disease_risk_high', 'cyclone_landfall', 'dam_release_started']);

export interface Mood { phase: Phase; intensity: number /* 0..1 water severity */ }

/** Returns [enabled, setEnabled]; drives the sound from the mood and the latest events. */
export function useSoundscape(mood: Mood | null, events: SimEvent[]): [boolean, (v: boolean) => void] {
  // Always starts off: browsers only allow audio after a click, so the player turns it on each visit.
  const [on, setOn] = useState(false);
  const ctx = useRef<Ctx | null>(null);
  const seen = useRef(0);
  const onRef = useRef(on);
  onRef.current = on;

  const set = (v: boolean) => {
    onRef.current = v;
    setOn(v);
    if (v && !ctx.current) ctx.current = build(); // created inside the click, so browsers allow audio
    if (ctx.current) {
      const c = ctx.current;
      if (v) c.ac.resume();
      c.master.gain.setTargetAtTime(v ? 0.6 : 0.0001, c.ac.currentTime, 0.4);
      if (!v) window.setTimeout(() => c.ac.state === 'running' && !onRef.current && c.ac.suspend(), 1500);
    }
  };

  // Ambient bed follows the mood
  useEffect(() => {
    const c = ctx.current;
    if (!c || !on) return;
    const t = c.ac.currentTime;
    const phase = mood?.phase ?? 'before';
    const k = mood?.intensity ?? 0;
    const rain = !mood ? 0.05 : phase === 'recovery' ? 0.02 : phase === 'flood' ? 0.35 + 0.4 * k : 0.12 + 0.2 * k;
    const wind = !mood ? 0.05 : phase === 'recovery' ? 0.03 : 0.08 + 0.35 * k;
    c.rain.gain.setTargetAtTime(rain, t, 1.2);
    c.rainFilter.frequency.setTargetAtTime(1400 - 600 * k, t, 1.2);
    c.wind.gain.setTargetAtTime(wind, t, 1.5);
    c.windFilter.frequency.setTargetAtTime(280 + 260 * k, t, 2);
  }, [on, mood?.phase, mood?.intensity, mood]);

  // Thunder near the peak, birds in recovery
  useEffect(() => {
    if (!on || !mood) return;
    const id = window.setInterval(() => {
      const c = ctx.current;
      if (!c) return;
      if (mood.phase !== 'recovery' && mood.intensity > 0.55 && Math.random() < 0.35) thunder(c, 0.4 + 0.6 * mood.intensity);
      if (mood.phase === 'recovery' && Math.random() < 0.6) { bird(c); window.setTimeout(() => ctx.current && bird(ctx.current), 220); }
    }, 5000);
    return () => window.clearInterval(id);
  }, [on, mood]);

  // Cues for new events
  useEffect(() => {
    const fresh = events.slice(seen.current);
    seen.current = events.length;
    const c = ctx.current;
    if (!c || !on || !fresh.length) return;
    if (fresh.some((e) => BAD.has(e.type))) {
      tone(c, [196, 165], 'triangle', 0.22, 0.14, 0.9);
      if (fresh.some((e) => e.type === 'embankment_breached' || e.type === 'cyclone_landfall')) thunder(c, 1);
    } else if (fresh.some((e) => e.type === 'phase_changed')) {
      tone(c, [392, 523, 659], 'sine', 0.16, 0.1, 1.2);
    } else if (fresh.some((e) => GOOD.has(e.type))) {
      tone(c, [659, 880], 'sine', 0.1, 0.08, 0.45);
    }
  }, [events, on]);

  useEffect(() => () => { ctx.current?.ac.close(); }, []);
  return [on, set];
}
