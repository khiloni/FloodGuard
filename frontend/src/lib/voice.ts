// Voice assistant using the browser's own speech engines (Web Speech API): nothing is downloaded.
// - Read aloud: speaks each new narration line, in the chosen language when the text is in it.
// - Speak an order: turns speech into a typed order. Recognition runs in the browser (Chrome and
//   Edge send audio to their speech service); the app itself never records or stores audio.
import { useCallback, useEffect, useRef, useState } from 'react';

const READ_KEY = 'floodguard.readAloud';

const synth = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);
const Recognition = (): any => (typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null);

export const canListen = () => !!Recognition();
export const canSpeak = () => !!synth();

export type VoiceRole = 'narrator' | 'command';

// Common female and male system voice names, so the two roles get clearly different voices.
const FEMALE = /heera|zira|swara|kalpana|neerja|dhwani|pallavi|shruti|vani|sapna|female|woman/i;
const MALE = /ravi|madhur|hemant|prabhat|niranjan|valluvar|mohan|david|mark|male/i;

/** Pick a voice: the text's own script decides the language; the role picks a different voice. */
function pickVoice(text: string, speechLang: string, role: VoiceRole) {
  const s = synth();
  const latinOnly = !/[^\u0000-ɏ\s\p{P}\p{S}\p{N}]/u.test(text);
  const lang = latinOnly ? 'en-IN' : speechLang;
  const all = s?.getVoices() || [];
  const base = lang.split('-')[0];
  const exact = all.filter((v) => v.lang === lang);
  const pool = exact.length ? exact : all.filter((v) => v.lang.startsWith(base));
  const narrator = pool.find((v) => FEMALE.test(v.name)) || pool[0] || null;
  const command = pool.find((v) => MALE.test(v.name) && v !== narrator) || pool.find((v) => v !== narrator) || narrator;
  if (role === 'command') {
    // Only one voice for this language? Make orders sound different with a lower pitch and quicker pace.
    return { voice: command, lang, pitch: command === narrator ? 0.7 : 0.95, rate: 1.08 };
  }
  return { voice: narrator, lang, pitch: 1.05, rate: 0.97 };
}

export function useVoice(speechLang: string) {
  const [readAloud, setReadAloudState] = useState<boolean>(() => {
    try { return window.localStorage.getItem(READ_KEY) === '1'; } catch { return false; }
  });
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);

  useEffect(() => { synth()?.getVoices(); }, []); // warms the voice list in Chrome

  const setReadAloud = (v: boolean) => {
    setReadAloudState(v);
    try { window.localStorage.setItem(READ_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
    if (!v) synth()?.cancel();
  };

  /** Queue a line in the narrator or command voice (spoken in order, never cut off). */
  const speak = useCallback((text: string, role: VoiceRole = 'narrator', force = false) => {
    const s = synth();
    if (!s || (!readAloud && !force) || !text) return;
    if (force) s.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').slice(0, 600));
    const { voice, lang, pitch, rate } = pickVoice(text, speechLang, role);
    u.lang = lang;
    if (voice) u.voice = voice;
    u.pitch = pitch;
    u.rate = rate;
    s.speak(u);
  }, [readAloud, speechLang]);

  /** Listen once; calls onText with the best transcript. Returns false if unsupported. */
  const listen = useCallback((onText: (t: string) => void, onError?: (msg: string) => void): boolean => {
    const R = Recognition();
    if (!R) return false;
    if (listening && rec.current) { rec.current.stop(); return true; }
    const r = new R();
    r.lang = speechLang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript || '';
      if (t.trim()) onText(t.trim());
    };
    r.onerror = (e: any) => { if (e.error !== 'aborted' && e.error !== 'no-speech') onError?.(e.error); };
    r.onend = () => setListening(false);
    rec.current = r;
    synth()?.cancel();
    setListening(true);
    r.start();
    return true;
  }, [speechLang, listening]);

  useEffect(() => () => { synth()?.cancel(); rec.current?.abort?.(); }, []);
  return { readAloud, setReadAloud, speak, listen, listening };
}
