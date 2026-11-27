// Interface language for the main screens. One choice drives the menus, AI narration (when the AI is
// on) and the voice assistant. Story content and fixed template narration stay in English.
// Translations were drafted for this project; native speakers are welcome to improve them.
import React, { createContext, useContext, useEffect, useState } from 'react';

export const LANGS = [
  { id: 'en', label: 'English', speech: 'en-IN' },
  { id: 'hi', label: 'हिन्दी (Hindi)', speech: 'hi-IN' },
  { id: 'gu', label: 'ગુજરાતી (Gujarati)', speech: 'gu-IN' },
  { id: 'mr', label: 'मराठी (Marathi)', speech: 'mr-IN' },
  { id: 'bn', label: 'বাংলা (Bengali)', speech: 'bn-IN' },
  { id: 'ta', label: 'தமிழ் (Tamil)', speech: 'ta-IN' },
  { id: 'te', label: 'తెలుగు (Telugu)', speech: 'te-IN' },
  { id: 'kn', label: 'ಕನ್ನಡ (Kannada)', speech: 'kn-IN' },
] as const;
export type Lang = (typeof LANGS)[number]['id'];

type Dict = Record<string, string>;

const en: Dict = {
  chooseStory: 'Choose a story',
  chooseStoryLede: 'Each story is a stylized teaching model of a real kind of hazard. You lead the response before, during and after it.',
  difficulty: 'Difficulty', easy: 'Easy', standard: 'Standard', hard: 'Hard',
  language: 'Language',
  langNote: 'Menus, stories, narration and the voice assistant all use this language.',
  begin: 'Begin this story', academy: 'Flood Academy', medals: 'Your medals', finished: 'stories finished',
  sound: 'Sound', soundOn: 'Sound on', reduceMotion: 'Reduce motion', motionReduced: 'Motion reduced',
  aiOn: 'AI on', aiOff: 'AI off',
  before: 'Before the flood', flood: 'During the flood', recovery: 'After the flood',
  act: 'Act', village: 'Village', whatToDo: 'What should I do?',
  footer: 'Educational simulation only. In a real emergency in India call',
  footerOr: 'or the disaster helpline',
  readAloud: 'Read aloud', reading: 'Reading aloud', speakOrder: 'Speak an order', listening: 'Listening…',
  voiceUnsupported: 'Voice input is not available in this browser. Try Chrome or Edge.',
  heard: 'Heard',
  academyTitle: 'Learn to stay safe, then lead',
  back: 'Back to the stories',
  conversation: 'Conversation', talkTo: 'Talk to', command: 'Command', giveOrders: 'Give orders',
  you: 'You', narrator: 'Narrator', notPossible: 'Not possible', tip: 'Tip', suggests: 'Suggests',
  useSuggestion: 'Use this suggestion', to: 'To', orderPlaceholder: 'Type an order, e.g. evacuate ward 1',
  askPlaceholder: 'Ask', send: 'Send', ask: 'Ask', oneTurn: '1 turn', outsideSupport: 'Outside support',
  arrivingAt: 'arriving at tick', sandbags: 'sandbags', supplies: 'supply units', alreadyUsed: 'already used',
  request: 'Request', arrivesIn: 'arrives in', ticks: 'ticks', status: 'Status',
  lensLoading: 'Looking into both futures…', lensSafe: 'safe in shelter', lensAtHome: 'still at home', lensLost: 'lost',
  lensBreach: 'Embankment breaks', lensWatch: 'Watch on map', lensScrub: 'Move through this future', lensNext: 'next',
  lensClose: 'Close the future view', lensIf: 'If you order', lensIfWait: 'If you wait',
  lensBetter: 'This order leads to a better future.', lensWorse: 'Waiting would turn out better than this order.',
  lensSame: 'Both futures look the same for now: the effect may come later.',
  lensNote: 'Played by the same simulation engine, so this is exactly what happens if nothing else changes. Nothing has happened yet.',
  lensToggle: 'Future Lens', lensToggleHint: 'Preview both futures before every order', futureView: 'Future view',
};

const KEY = 'floodguard.lang';

// ---- English-keyed dictionaries for all other interface text: tr('Open a shelter') ----
// One JSON file per language in src/i18n/, loaded only when that language is chosen.
let current: Record<string, string> = {};
const loaders = import.meta.glob('../i18n/*.json');

/** Marks an English string stored as data, so the dictionary check finds it; tr() it where shown. */
export const N_ = (s: string) => s;

/** Translate an English interface string; {name} placeholders are filled from vars. */
export function tr(en: string, vars?: Record<string, string | number>): string {
  let out = current[en] ?? en;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

async function loadDict(l: Lang): Promise<Record<string, string>> {
  const load = loaders[`../i18n/${l}.json`];
  if (!load) return {};
  const mod: any = await load();
  return mod.default || mod;
}

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof en) => string; speech: string }
const Ctx = createContext<LangCtx>({ lang: 'en', setLang: () => {}, t: (k) => tr(en[k]), speech: 'en-IN' });

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setL] = useState<Lang>(() => {
    try {
      const v = window.localStorage.getItem(KEY) as Lang | null;
      return v && LANGS.some((x) => x.id === v) ? v : 'en';
    } catch { return 'en'; }
  });
  const [, setVersion] = useState(0);
  // Load this language's interface dictionary, then re-render everything.
  useEffect(() => {
    let live = true;
    document.documentElement.lang = lang;
    if (lang === 'en') { current = {}; setVersion((v) => v + 1); return; }
    loadDict(lang).then((d) => { if (live) { current = d; setVersion((v) => v + 1); } });
    return () => { live = false; };
  }, [lang]);
  const setLang = (l: Lang) => {
    setL(l);
    try { window.localStorage.setItem(KEY, l); } catch { /* storage unavailable */ }
    document.documentElement.lang = l;
  };
  const t = (k: keyof typeof en) => tr(en[k]);
  const speech = LANGS.find((x) => x.id === lang)?.speech ?? 'en-IN';
  return <Ctx.Provider value={{ lang, setLang, t, speech }}>{children}</Ctx.Provider>;
};

export const useLang = () => useContext(Ctx);
