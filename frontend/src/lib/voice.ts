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

/** Pick a voice: the text's own script decides, so English template text is read by an English voice. */
function pickVoice(text: string, speechLang: string): { voice: SpeechSynthesisVoice | null; lang: string } {
  const s = synth();
  const latinOnly = !/[^\u0000-ɏ\s\p{P}\p{S}\p{N}]/u.test(text);
  const lang = latinOnly ? 'en-IN' : speechLang;
  const voices = s?.getVoices() || [];
  const base = lang.split('-')[0];
  const voice = voices.find((v) => v.lang === lang) || voices.find((v) => v.lang.startsWith(base)) || null;
  return { voice, lang };
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

  const speak = useCallback((text: string, force = false) => {
    const s = synth();
    if (!s || (!readAloud && !force) || !text) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').slice(0, 600));
    const { voice, lang } = pickVoice(text, speechLang);
    u.lang = lang;
    if (voice) u.voice = voice;
    u.rate = 1;
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
