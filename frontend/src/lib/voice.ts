// Voice assistant using the browser's own speech engines (Web Speech API): nothing is downloaded.
// - Read aloud: speaks each new narration line, in the chosen language when the text is in it.
// - Speak an order: turns speech into a typed order. Recognition runs in the browser (Chrome and
//   Edge send audio to their speech service); the app itself never records or stores audio.
import { useCallback, useEffect, useRef, useState } from 'react';

const API = ((import.meta as any).env?.VITE_API_BASE ?? '').replace(/\/$/, '') + '/api/v1';

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

/** provider 'sarvam': natural Indian-language voices and speech-to-English from the server;
 *  'browser': the device's own speech engines. Sarvam falls back to the browser on any error. */
export function useVoice(speechLang: string, lang = 'en', provider: string = 'browser') {
  const [readAloud, setReadAloudState] = useState<boolean>(() => {
    try { return window.localStorage.getItem(READ_KEY) === '1'; } catch { return false; }
  });
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const gen = useRef(0); // bumps when speech is cancelled, so queued lines are dropped
  const server = provider === 'sarvam';

  useEffect(() => { synth()?.getVoices(); }, []); // warms the voice list in Chrome

  const stopAll = () => {
    gen.current += 1;
    synth()?.cancel();
    audioEl.current?.pause();
    queue.current = Promise.resolve();
  };

  const setReadAloud = (v: boolean) => {
    setReadAloudState(v);
    try { window.localStorage.setItem(READ_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
    if (!v) stopAll();
  };

  const browserSpeak = (text: string, role: VoiceRole) => {
    const s = synth();
    if (!s) return;
    const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').slice(0, 600));
    const { voice, lang: l, pitch, rate } = pickVoice(text, speechLang, role);
    u.lang = l;
    if (voice) u.voice = voice;
    u.pitch = pitch;
    u.rate = rate;
    s.speak(u);
  };

  const serverSpeak = async (text: string, role: VoiceRole, myGen: number) => {
    const res = await fetch(`${API}/voice/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language: lang, role }) });
    if (!res.ok) throw new Error(String(res.status));
    const { audio_b64 } = await res.json();
    if (myGen !== gen.current) return;
    await new Promise<void>((resolve) => {
      const el = audioEl.current || (audioEl.current = new Audio());
      el.src = `data:audio/wav;base64,${audio_b64}`;
      el.onended = () => resolve();
      el.onerror = () => resolve();
      el.play().catch(() => resolve());
    });
  };

  /** Queue a line in the narrator or command voice (spoken in order, never cut off). */
  const speak = useCallback((text: string, role: VoiceRole = 'narrator', force = false) => {
    if ((!readAloud && !force) || !text) return;
    if (force) stopAll();
    if (!server) { browserSpeak(text, role); return; }
    const myGen = gen.current;
    queue.current = queue.current.then(() => serverSpeak(text, role, myGen)).catch(() => { if (myGen === gen.current) browserSpeak(text, role); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readAloud, speechLang, lang, server]);

  /** Server listening: record until tapped again (or 8 s), then translate the speech to English. */
  const serverListen = (onText: (t: string) => void, onError?: (msg: string) => void): boolean => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return false;
    if (recorder.current) { recorder.current.stop(); return true; }
    stopAll();
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.current = mr;
      setListening(true);
      const timer = window.setTimeout(() => mr.state === 'recording' && mr.stop(), 8000);
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        window.clearTimeout(timer);
        stream.getTracks().forEach((t) => t.stop());
        recorder.current = null;
        setListening(false);
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        try {
          const res = await fetch(`${API}/voice/listen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio_b64: btoa(bin), mime: blob.type, language: lang }) });
          if (!res.ok) throw new Error(String(res.status));
          const j = await res.json();
          if (j.transcript) onText(j.transcript); else onError?.('no speech heard');
        } catch (e) { onError?.((e as Error).message); }
      };
      mr.start();
    }).catch(() => onError?.('microphone blocked'));
    return true;
  };

  /** Listen once; calls onText with the transcript (English when the server translates). */
  const listen = useCallback((onText: (t: string) => void, onError?: (msg: string) => void): boolean => {
    if (server && serverListen(onText, onError)) return true;
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
    stopAll();
    setListening(true);
    r.start();
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechLang, listening, server, lang]);

  useEffect(() => () => { stopAll(); rec.current?.abort?.(); recorder.current?.stop(); }, []);
  return { readAloud, setReadAloud, speak, listen, listening, server };
}
