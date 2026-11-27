// Interface language for the main screens. One choice drives the menus, AI narration (when the AI is
// on) and the voice assistant. Story content and fixed template narration stay in English.
// Translations were drafted for this project; native speakers are welcome to improve them.
import React, { createContext, useContext, useState } from 'react';

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
  langNote: 'Menus, AI narration and the voice assistant use this language. Story text and fixed narration stay in English.',
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

const hi: Dict = {
  chooseStory: 'एक कहानी चुनें',
  chooseStoryLede: 'हर कहानी एक असली आपदा का सरल शिक्षण मॉडल है। आप आपदा से पहले, उसके दौरान और बाद में राहत का नेतृत्व करते हैं।',
  difficulty: 'कठिनाई', easy: 'आसान', standard: 'सामान्य', hard: 'कठिन',
  language: 'भाषा',
  langNote: 'मेनू, AI वर्णन और वॉइस सहायक इस भाषा का उपयोग करते हैं। कहानी का पाठ अंग्रेज़ी में रहता है।',
  begin: 'यह कहानी शुरू करें', academy: 'बाढ़ अकादमी', medals: 'आपके पदक', finished: 'कहानियाँ पूरी',
  sound: 'ध्वनि', soundOn: 'ध्वनि चालू', reduceMotion: 'एनीमेशन कम करें', motionReduced: 'एनीमेशन कम',
  aiOn: 'AI चालू', aiOff: 'AI बंद',
  before: 'बाढ़ से पहले', flood: 'बाढ़ के दौरान', recovery: 'बाढ़ के बाद',
  act: 'कार्य', village: 'गाँव', whatToDo: 'मुझे क्या करना चाहिए?',
  footer: 'केवल शैक्षिक सिमुलेशन। भारत में असली आपातकाल में कॉल करें',
  footerOr: 'या आपदा हेल्पलाइन',
  readAloud: 'पढ़कर सुनाएँ', reading: 'पढ़ रहा है', speakOrder: 'बोलकर आदेश दें', listening: 'सुन रहा है…',
  voiceUnsupported: 'इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है। Chrome या Edge आज़माएँ।',
  heard: 'सुना',
  academyTitle: 'सुरक्षित रहना सीखें, फिर नेतृत्व करें',
  back: 'कहानियों पर वापस',
};

const gu: Dict = {
  chooseStory: 'એક વાર્તા પસંદ કરો',
  chooseStoryLede: 'દરેક વાર્તા એક વાસ્તવિક આપત્તિનું સરળ શૈક્ષણિક મોડેલ છે. તમે આપત્તિ પહેલાં, દરમિયાન અને પછી રાહત કાર્યનું નેતૃત્વ કરો છો.',
  difficulty: 'મુશ્કેલી', easy: 'સરળ', standard: 'સામાન્ય', hard: 'મુશ્કેલ',
  language: 'ભાષા',
  langNote: 'મેનુ, AI વર્ણન અને વૉઇસ સહાયક આ ભાષાનો ઉપયોગ કરે છે. વાર્તાનો લખાણ અંગ્રેજીમાં રહે છે.',
  begin: 'આ વાર્તા શરૂ કરો', academy: 'પૂર અકાદમી', medals: 'તમારા ચંદ્રકો', finished: 'વાર્તાઓ પૂર્ણ',
  sound: 'અવાજ', soundOn: 'અવાજ ચાલુ', reduceMotion: 'એનિમેશન ઓછું કરો', motionReduced: 'એનિમેશન ઓછું',
  aiOn: 'AI ચાલુ', aiOff: 'AI બંધ',
  before: 'પૂર પહેલાં', flood: 'પૂર દરમિયાન', recovery: 'પૂર પછી',
  act: 'કાર્ય', village: 'ગામ', whatToDo: 'મારે શું કરવું જોઈએ?',
  footer: 'માત્ર શૈક્ષણિક સિમ્યુલેશન. ભારતમાં વાસ્તવિક કટોકટીમાં કૉલ કરો',
  footerOr: 'અથવા આપત્તિ હેલ્પલાઇન',
  readAloud: 'મોટેથી વાંચો', reading: 'વાંચી રહ્યું છે', speakOrder: 'બોલીને આદેશ આપો', listening: 'સાંભળી રહ્યું છે…',
  voiceUnsupported: 'આ બ્રાઉઝરમાં વૉઇસ ઇનપુટ ઉપલબ્ધ નથી. Chrome અથવા Edge અજમાવો.',
  heard: 'સાંભળ્યું',
  academyTitle: 'સુરક્ષિત રહેતા શીખો, પછી નેતૃત્વ કરો',
  back: 'વાર્તાઓ પર પાછા',
};

const mr: Dict = {
  chooseStory: 'एक कथा निवडा',
  chooseStoryLede: 'प्रत्येक कथा एका खऱ्या आपत्तीचे सोपे शैक्षणिक मॉडेल आहे. आपत्तीपूर्वी, दरम्यान आणि नंतर तुम्ही मदतकार्याचे नेतृत्व करता.',
  difficulty: 'काठिण्य', easy: 'सोपे', standard: 'सामान्य', hard: 'कठीण',
  language: 'भाषा',
  langNote: 'मेनू, AI वर्णन आणि व्हॉइस सहाय्यक ही भाषा वापरतात. कथेचा मजकूर इंग्रजीत राहतो.',
  begin: 'ही कथा सुरू करा', academy: 'पूर अकादमी', medals: 'तुमची पदके', finished: 'कथा पूर्ण',
  sound: 'आवाज', soundOn: 'आवाज चालू', reduceMotion: 'ॲनिमेशन कमी करा', motionReduced: 'ॲनिमेशन कमी',
  aiOn: 'AI चालू', aiOff: 'AI बंद',
  before: 'पुरापूर्वी', flood: 'पुरादरम्यान', recovery: 'पुरानंतर',
  act: 'कृती', village: 'गाव', whatToDo: 'मी काय करावे?',
  footer: 'केवळ शैक्षणिक सिम्युलेशन. भारतात खऱ्या आणीबाणीत कॉल करा',
  footerOr: 'किंवा आपत्ती हेल्पलाइन',
  readAloud: 'मोठ्याने वाचा', reading: 'वाचत आहे', speakOrder: 'बोलून आदेश द्या', listening: 'ऐकत आहे…',
  voiceUnsupported: 'या ब्राउझरमध्ये व्हॉइस इनपुट उपलब्ध नाही. Chrome किंवा Edge वापरा.',
  heard: 'ऐकले',
  academyTitle: 'सुरक्षित राहायला शिका, मग नेतृत्व करा',
  back: 'कथांकडे परत',
};

const bn: Dict = {
  chooseStory: 'একটি গল্প বেছে নিন',
  chooseStoryLede: 'প্রতিটি গল্প একটি বাস্তব দুর্যোগের সহজ শিক্ষামূলক মডেল। দুর্যোগের আগে, সময় এবং পরে আপনি ত্রাণ কাজের নেতৃত্ব দেন।',
  difficulty: 'কাঠিন্য', easy: 'সহজ', standard: 'সাধারণ', hard: 'কঠিন',
  language: 'ভাষা',
  langNote: 'মেনু, AI বর্ণনা এবং ভয়েস সহকারী এই ভাষা ব্যবহার করে। গল্পের লেখা ইংরেজিতে থাকে।',
  begin: 'এই গল্প শুরু করুন', academy: 'বন্যা অ্যাকাডেমি', medals: 'আপনার পদক', finished: 'গল্প সম্পূর্ণ',
  sound: 'শব্দ', soundOn: 'শব্দ চালু', reduceMotion: 'অ্যানিমেশন কমান', motionReduced: 'অ্যানিমেশন কম',
  aiOn: 'AI চালু', aiOff: 'AI বন্ধ',
  before: 'বন্যার আগে', flood: 'বন্যার সময়', recovery: 'বন্যার পরে',
  act: 'কাজ', village: 'গ্রাম', whatToDo: 'আমার কী করা উচিত?',
  footer: 'শুধুমাত্র শিক্ষামূলক সিমুলেশন। ভারতে প্রকৃত জরুরি অবস্থায় কল করুন',
  footerOr: 'অথবা দুর্যোগ হেল্পলাইন',
  readAloud: 'জোরে পড়ুন', reading: 'পড়ছে', speakOrder: 'বলে আদেশ দিন', listening: 'শুনছে…',
  voiceUnsupported: 'এই ব্রাউজারে ভয়েস ইনপুট নেই। Chrome বা Edge ব্যবহার করুন।',
  heard: 'শোনা গেছে',
  academyTitle: 'নিরাপদ থাকতে শিখুন, তারপর নেতৃত্ব দিন',
  back: 'গল্পে ফিরে যান',
};

const ta: Dict = {
  chooseStory: 'ஒரு கதையைத் தேர்ந்தெடுக்கவும்',
  chooseStoryLede: 'ஒவ்வொரு கதையும் ஒரு உண்மையான பேரிடரின் எளிய கற்றல் மாதிரி. பேரிடருக்கு முன், போது மற்றும் பின் நீங்கள் மீட்புப் பணியை வழிநடத்துகிறீர்கள்.',
  difficulty: 'கடினம்', easy: 'எளிது', standard: 'இயல்பு', hard: 'கடினம்',
  language: 'மொழி',
  langNote: 'மெனு, AI விவரிப்பு மற்றும் குரல் உதவியாளர் இந்த மொழியைப் பயன்படுத்தும். கதை உரை ஆங்கிலத்தில் இருக்கும்.',
  begin: 'இந்தக் கதையைத் தொடங்கு', academy: 'வெள்ள அகாடமி', medals: 'உங்கள் பதக்கங்கள்', finished: 'கதைகள் முடிந்தன',
  sound: 'ஒலி', soundOn: 'ஒலி இயக்கத்தில்', reduceMotion: 'அசைவைக் குறை', motionReduced: 'அசைவு குறைவு',
  aiOn: 'AI இயக்கத்தில்', aiOff: 'AI அணைப்பு',
  before: 'வெள்ளத்திற்கு முன்', flood: 'வெள்ளத்தின் போது', recovery: 'வெள்ளத்திற்குப் பின்',
  act: 'செயல்', village: 'கிராமம்', whatToDo: 'நான் என்ன செய்ய வேண்டும்?',
  footer: 'கல்வி உருவகப்படுத்தல் மட்டுமே. இந்தியாவில் உண்மையான அவசரத்தில் அழைக்கவும்',
  footerOr: 'அல்லது பேரிடர் உதவி எண்',
  readAloud: 'உரக்கப் படி', reading: 'படிக்கிறது', speakOrder: 'பேசி ஆணையிடு', listening: 'கேட்கிறது…',
  voiceUnsupported: 'இந்த உலாவியில் குரல் உள்ளீடு இல்லை. Chrome அல்லது Edge பயன்படுத்தவும்.',
  heard: 'கேட்டது',
  academyTitle: 'பாதுகாப்பாக இருக்கக் கற்று, பின் வழிநடத்து',
  back: 'கதைகளுக்குத் திரும்பு',
};

const te: Dict = {
  chooseStory: 'ఒక కథను ఎంచుకోండి',
  chooseStoryLede: 'ప్రతి కథ ఒక నిజమైన విపత్తుకు సరళమైన బోధనా నమూనా. విపత్తుకు ముందు, సమయంలో మరియు తర్వాత మీరు సహాయక చర్యలకు నాయకత్వం వహిస్తారు.',
  difficulty: 'కష్టతరం', easy: 'సులభం', standard: 'సాధారణం', hard: 'కష్టం',
  language: 'భాష',
  langNote: 'మెనూలు, AI కథనం మరియు వాయిస్ సహాయకుడు ఈ భాషను ఉపయోగిస్తాయి. కథ పాఠ్యం ఆంగ్లంలో ఉంటుంది.',
  begin: 'ఈ కథను ప్రారంభించండి', academy: 'వరద అకాడమీ', medals: 'మీ పతకాలు', finished: 'కథలు పూర్తయ్యాయి',
  sound: 'శబ్దం', soundOn: 'శబ్దం ఆన్', reduceMotion: 'కదలిక తగ్గించు', motionReduced: 'కదలిక తగ్గింది',
  aiOn: 'AI ఆన్', aiOff: 'AI ఆఫ్',
  before: 'వరదకు ముందు', flood: 'వరద సమయంలో', recovery: 'వరద తర్వాత',
  act: 'చర్య', village: 'గ్రామం', whatToDo: 'నేను ఏమి చేయాలి?',
  footer: 'విద్యా సిమ్యులేషన్ మాత్రమే. భారతదేశంలో నిజమైన అత్యవసర పరిస్థితిలో కాల్ చేయండి',
  footerOr: 'లేదా విపత్తు హెల్ప్‌లైన్',
  readAloud: 'బిగ్గరగా చదువు', reading: 'చదువుతోంది', speakOrder: 'మాట్లాడి ఆదేశించండి', listening: 'వింటోంది…',
  voiceUnsupported: 'ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ లేదు. Chrome లేదా Edge ప్రయత్నించండి.',
  heard: 'విన్నది',
  academyTitle: 'సురక్షితంగా ఉండటం నేర్చుకోండి, తర్వాత నడిపించండి',
  back: 'కథలకు తిరిగి',
};

const kn: Dict = {
  chooseStory: 'ಒಂದು ಕಥೆಯನ್ನು ಆರಿಸಿ',
  chooseStoryLede: 'ಪ್ರತಿ ಕಥೆಯೂ ನಿಜವಾದ ವಿಪತ್ತಿನ ಸರಳ ಕಲಿಕಾ ಮಾದರಿ. ವಿಪತ್ತಿನ ಮೊದಲು, ಸಮಯದಲ್ಲಿ ಮತ್ತು ನಂತರ ನೀವು ಪರಿಹಾರ ಕಾರ್ಯವನ್ನು ಮುನ್ನಡೆಸುತ್ತೀರಿ.',
  difficulty: 'ಕಠಿಣತೆ', easy: 'ಸುಲಭ', standard: 'ಸಾಮಾನ್ಯ', hard: 'ಕಠಿಣ',
  language: 'ಭಾಷೆ',
  langNote: 'ಮೆನು, AI ನಿರೂಪಣೆ ಮತ್ತು ಧ್ವನಿ ಸಹಾಯಕ ಈ ಭಾಷೆಯನ್ನು ಬಳಸುತ್ತವೆ. ಕಥೆಯ ಪಠ್ಯ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಇರುತ್ತದೆ.',
  begin: 'ಈ ಕಥೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿ', academy: 'ಪ್ರವಾಹ ಅಕಾಡೆಮಿ', medals: 'ನಿಮ್ಮ ಪದಕಗಳು', finished: 'ಕಥೆಗಳು ಮುಗಿದಿವೆ',
  sound: 'ಧ್ವನಿ', soundOn: 'ಧ್ವನಿ ಆನ್', reduceMotion: 'ಚಲನೆ ಕಡಿಮೆ ಮಾಡಿ', motionReduced: 'ಚಲನೆ ಕಡಿಮೆ',
  aiOn: 'AI ಆನ್', aiOff: 'AI ಆಫ್',
  before: 'ಪ್ರವಾಹದ ಮೊದಲು', flood: 'ಪ್ರವಾಹದ ಸಮಯದಲ್ಲಿ', recovery: 'ಪ್ರವಾಹದ ನಂತರ',
  act: 'ಕ್ರಿಯೆ', village: 'ಗ್ರಾಮ', whatToDo: 'ನಾನು ಏನು ಮಾಡಬೇಕು?',
  footer: 'ಕೇವಲ ಶೈಕ್ಷಣಿಕ ಸಿಮ್ಯುಲೇಶನ್. ಭಾರತದಲ್ಲಿ ನಿಜವಾದ ತುರ್ತು ಸ್ಥಿತಿಯಲ್ಲಿ ಕರೆ ಮಾಡಿ',
  footerOr: 'ಅಥವಾ ವಿಪತ್ತು ಸಹಾಯವಾಣಿ',
  readAloud: 'ಗಟ್ಟಿಯಾಗಿ ಓದು', reading: 'ಓದುತ್ತಿದೆ', speakOrder: 'ಮಾತನಾಡಿ ಆದೇಶಿಸಿ', listening: 'ಕೇಳುತ್ತಿದೆ…',
  voiceUnsupported: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಲಭ್ಯವಿಲ್ಲ. Chrome ಅಥವಾ Edge ಬಳಸಿ.',
  heard: 'ಕೇಳಿದ್ದು',
  academyTitle: 'ಸುರಕ್ಷಿತವಾಗಿರಲು ಕಲಿಯಿರಿ, ನಂತರ ಮುನ್ನಡೆಸಿ',
  back: 'ಕಥೆಗಳಿಗೆ ಹಿಂತಿರುಗಿ',
};

const DICTS: Record<Lang, Dict> = { en, hi, gu, mr, bn, ta, te, kn };
const KEY = 'floodguard.lang';

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof en) => string; speech: string }
const Ctx = createContext<LangCtx>({ lang: 'en', setLang: () => {}, t: (k) => en[k], speech: 'en-IN' });

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setL] = useState<Lang>(() => {
    try {
      const v = window.localStorage.getItem(KEY) as Lang | null;
      return v && v in DICTS ? v : 'en';
    } catch { return 'en'; }
  });
  const setLang = (l: Lang) => {
    setL(l);
    try { window.localStorage.setItem(KEY, l); } catch { /* storage unavailable */ }
    document.documentElement.lang = l;
  };
  const t = (k: keyof typeof en) => DICTS[lang][k] ?? en[k];
  const speech = LANGS.find((x) => x.id === lang)?.speech ?? 'en-IN';
  return <Ctx.Provider value={{ lang, setLang, t, speech }}>{children}</Ctx.Provider>;
};

export const useLang = () => useContext(Ctx);
