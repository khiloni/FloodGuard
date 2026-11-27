// Flood Academy content: general, widely taught flood-safety knowledge in plain words.
// It is educational, not official guidance: always follow local authorities in a real emergency.

export interface Lesson {
  id: string;
  title: string;
  art: 'river' | 'city' | 'dam' | 'coast' | 'island' | 'mountain' | 'after';
  summary: string;
  points: string[];
  doThis: string;
}

export const LESSONS: Lesson[] = [
  {
    id: 'river', title: 'How rivers flood', art: 'river',
    summary: 'Days of heavy monsoon rain upstream fill a river faster than it can drain. The water rises over hours or days, so there is usually time to act if you watch the warnings.',
    points: [
      'River gauges compare today\'s level with a warning level and a danger level.',
      'Embankments (bunds) hold water back, but they can be overtopped or breach, and a breach floods land very quickly.',
      'The lowest homes nearest the river flood first, and their roads go under before the houses do.',
    ],
    doThis: 'Move early, while roads are still dry. Waiting for water to reach the door often means walking or driving through it.',
  },
  {
    id: 'city', title: 'Flash floods in cities', art: 'city',
    summary: 'A cloudburst can drop more rain in an hour than drains can carry. Streets turn into channels within minutes, especially where drains are blocked by plastic and silt.',
    points: [
      'Underpasses, basements and low roads fill first and fastest.',
      'Open manholes are hidden under brown water and can swallow a person.',
      'Fallen wires and flooded electrical boxes make water dangerous.',
    ],
    doThis: 'Never drive or walk into a flooded underpass. Go up, not out: an upper floor is often safer than a flooded street.',
  },
  {
    id: 'dam', title: 'Dam releases', art: 'dam',
    summary: 'When a reservoir is nearly full, operators must release water to keep the dam safe. Downstream, the river can rise suddenly even on a sunny day.',
    points: [
      'Release notices are usually announced in advance; take them seriously.',
      'Releasing water more slowly over a longer time lowers the peak downstream.',
      'Riverbanks, ghats and sandbars below a dam are the most exposed places.',
    ],
    doThis: 'Leave riverbanks and low ghats as soon as a release is announced, and do not return until authorities say so.',
  },
  {
    id: 'coast', title: 'Cyclones and storm surge', art: 'coast',
    summary: 'A cyclone\'s winds push the sea onto the land. This storm surge, not the wind, causes most cyclone deaths, and it peaks around landfall.',
    points: [
      'Weather services issue colour-coded cyclone warnings days ahead.',
      'Fishing boats need hours to return to harbour, so they must be recalled early.',
      'Strong winds cut power and block roads with fallen trees around landfall.',
    ],
    doThis: 'Reach a cyclone shelter or strong building on high ground before the wind rises, and stay inside until the all-clear: the calm eye is not the end.',
  },
  {
    id: 'island', title: 'River islands (chars)', art: 'island',
    summary: 'Families living on sandbar islands in big rivers have no road to the mainland. Every evacuation needs boats, and boats need time and calmer water.',
    points: [
      'The current gets stronger as the river rises, making every crossing slower and riskier.',
      'Raised platforms and plinths keep people, food and animals above the water nearby.',
      'People are reluctant to leave cattle and tools; trusted local voices help.',
    ],
    doThis: 'Start boat evacuations of children, elders and the sick first, and start early while the river is still manageable.',
  },
  {
    id: 'mountain', title: 'Glacial lake outbursts', art: 'mountain',
    summary: 'High mountain lakes held back by loose rock (moraine) can burst. A surge of water, mud and boulders races down the valley in minutes to hours.',
    points: [
      'Sensors and cameras on the lake can give a short but precious warning.',
      'The valley floor and river terraces are in the path; ridges and slopes above are safer.',
      'Bridges and roads along the river are often destroyed, cutting the valley off.',
    ],
    doThis: 'When the siren sounds, climb uphill, away from the river. Do not go to the river to look.',
  },
  {
    id: 'after', title: 'After the water goes down', art: 'after',
    summary: 'Many flood illnesses and injuries happen after the peak. Recovery needs clean water, health care, safe power and safe roads before people go home.',
    points: [
      'Floodwater contaminates wells and hand pumps: boil, filter or chlorinate drinking water.',
      'Diarrhoea, skin infections, leptospirosis and mosquito-borne diseases rise after floods.',
      'Wet wiring can electrocute; snakes and debris hide in mud and water.',
    ],
    doThis: 'Return home only when authorities say it is safe. Switch power on only after an electrician checks it.',
  },
];

export const DEPTHS = [
  { cm: 0, title: 'Dry ground', text: 'Safe to move. This is the time to leave if a warning is in force.' },
  { cm: 15, title: '15 cm: ankle deep', text: 'Fast-moving water this shallow can knock an adult off their feet. You cannot see open drains or holes under it.' },
  { cm: 30, title: '30 cm: knee deep', text: 'Enough to float many cars and stall engines. Walking against a current is very hard.' },
  { cm: 60, title: '60 cm: thigh to waist deep', text: 'Can sweep away most vehicles, including large ones. Only trained rescuers with boats should move here.' },
  { cm: 120, title: '120 cm and more', text: 'Over a child\'s head and an adult\'s chest. Get to the highest floor or roof and signal for help.' },
];

export interface KitItem { id: string; label: string; emoji: string; essential: boolean; why: string }

export const KIT: KitItem[] = [
  { id: 'water', label: 'Drinking water', emoji: '💧', essential: true, why: 'Floodwater is not safe to drink. Carry enough clean water for at least a day.' },
  { id: 'food', label: 'Ready-to-eat food', emoji: '🍪', essential: true, why: 'Dry snacks and packed food that need no cooking or fridge.' },
  { id: 'torch', label: 'Torch and spare batteries', emoji: '🔦', essential: true, why: 'Power often fails. A torch is safer than a flame in a crowded shelter.' },
  { id: 'firstaid', label: 'First-aid kit and medicines', emoji: '🩹', essential: true, why: 'Include daily medicines, ORS sachets and any prescriptions.' },
  { id: 'docs', label: 'ID and documents in a waterproof bag', emoji: '📄', essential: true, why: 'Needed for relief, insurance and rebuilding. Keep copies too.' },
  { id: 'phone', label: 'Phone and charged power bank', emoji: '📱', essential: true, why: 'For alerts and calling for help. Save emergency numbers first.' },
  { id: 'whistle', label: 'Whistle', emoji: '📯', essential: true, why: 'Rescuers hear a whistle much farther than a voice.' },
  { id: 'cash', label: 'Some cash', emoji: '💵', essential: true, why: 'ATMs and digital payments may not work after a flood.' },
  { id: 'radio', label: 'Battery radio', emoji: '📻', essential: true, why: 'Official updates still reach you when mobile networks fail.' },
  { id: 'clothes', label: 'Warm clothes and a blanket', emoji: '🧥', essential: true, why: 'Shelters are cold and damp at night, hardest for babies and elders.' },
  { id: 'hygiene', label: 'Soap, sanitary items, masks', emoji: '🧼', essential: true, why: 'Hand washing and hygiene prevent disease in crowded places.' },
  { id: 'tv', label: 'Television', emoji: '📺', essential: false, why: 'Heavy, needs power, and useless in a shelter. Leave it.' },
  { id: 'rice', label: 'A 25 kg sack of rice', emoji: '🌾', essential: false, why: 'Too heavy to carry quickly, and it needs cooking. Pack light ready-to-eat food.' },
  { id: 'candles', label: 'Candles and matches only', emoji: '🕯️', essential: false, why: 'Open flames are a fire risk in crowded shelters. A torch is better.' },
  { id: 'albums', label: 'Heavy photo albums', emoji: '📚', essential: false, why: 'Precious, but heavy. Store them high at home or keep digital copies.' },
];

export const PLAN = [
  'We know our nearest safe shelter and two routes to reach it.',
  'We saved 112 (emergency) and 1078 (disaster helpline) and local numbers in every phone.',
  'We agreed a family meeting place if we get separated.',
  'We have a plan for elders, children, anyone with a disability, and our animals.',
  'Our documents are copied and kept in a waterproof bag, stored high.',
  'We know how to switch off the main power and gas.',
  'We get official alerts (cell broadcast, weather service, district messages).',
  'Our go-bag is packed and everyone knows where it is.',
];

export interface Question { q: string; options: string[]; answer: number; why: string }

export const QUIZ: Question[] = [
  { q: 'Water is flowing across the road ahead, about ankle deep. What should you do?', options: ['Walk through quickly', 'Drive through slowly', 'Turn around and find another way', 'Wait in the water for help'], answer: 2,
    why: 'Even 15 cm of moving water can knock a person over, and 30 cm can float a car. Turn around, do not drown.' },
  { q: 'When is the best time to evacuate a low-lying area before a river flood?', options: ['When water reaches the door', 'Early, while roads are still dry', 'Only after the embankment breaks', 'At the flood peak'], answer: 1,
    why: 'Roads flood before houses. Leaving early means you can still use vehicles and walk safely.' },
  { q: 'Who should be helped to evacuate first?', options: ['The people who shout loudest', 'Shop owners and their stock', 'Elders, children, pregnant women and people with disabilities', 'Whoever lives closest to the shelter'], answer: 2,
    why: 'Vulnerable people need more time and help to move, so they go first.' },
  { q: 'During a cyclone the wind suddenly stops and the sky clears. What is happening?', options: ['The cyclone is over', 'It may be the eye: the other side of the storm is coming', 'It is safe to go to the beach', 'The surge has finished'], answer: 1,
    why: 'The calm eye can last minutes before winds return from the opposite direction. Stay inside until the official all-clear.' },
  { q: 'After a flood, a village hand pump has been under water. The water looks clear. Is it safe to drink?', options: ['Yes, if it looks clear', 'Only after boiling, filtering or chlorinating it', 'Yes, if it tastes normal', 'Only in the morning'], answer: 1,
    why: 'Floodwater carries germs you cannot see. Treat the water until the source has been cleaned and tested.' },
  { q: 'A glacial lake warning siren sounds in your valley. Where should you go?', options: ['To the river to see the water', 'Uphill, away from the river', 'Onto the bridge', 'Into a basement'], answer: 1,
    why: 'Outburst floods follow the valley floor. Higher ground on the slopes is safer.' },
  { q: 'Why is a staggered (slower) dam release helpful downstream?', options: ['It adds more water', 'It lowers the peak, giving people more time', 'It makes the river warmer', 'It has no effect'], answer: 1,
    why: 'The same water spread over a longer time gives a lower peak and more time to move.' },
  { q: 'What is the most useful light in a crowded flood shelter?', options: ['Candles', 'A kerosene lamp', 'A torch with spare batteries', 'A bonfire'], answer: 2,
    why: 'Open flames are a fire risk in crowded spaces. A torch is safe and portable.' },
  { q: 'Your home has been flooded. When can you switch the power back on?', options: ['As soon as you get home', 'After an electrician says the wiring is safe', 'When the floor looks dry', 'Never again'], answer: 1,
    why: 'Wet wiring and sockets can electrocute. Have them checked first.' },
  { q: 'In India, which number connects you to emergency services?', options: ['100 only', '112', '911', '999'], answer: 1,
    why: '112 is India\'s single emergency number; 1078 is the national disaster helpline. Always follow local authorities.' },
];
