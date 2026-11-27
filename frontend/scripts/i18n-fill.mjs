// Merge an ordered list of translations into a language dictionary.
//   node scripts/i18n-fill.mjs <lang> <translations.json>
// translations.json is an array in the same order as i18n-work/_missing.<lang>.json (produced by
// `node scripts/i18n-extract.mjs --missing`), so English keys are never retyped by hand.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [lang, file] = process.argv.slice(2);
const missing = JSON.parse(readFileSync(process.argv.includes('--full') ? 'i18n-work/_source.json' : `i18n-work/_missing.${lang}.json`, 'utf8'));
let list = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(list)) {
  // {"0": "...", "1": "..."}: each entry carries its index, so a skipped line cannot shift the rest
  const gaps = missing.map((_, i) => i).filter((i) => !(String(i) in list));
  if (gaps.length) { console.error(`missing indexes: ${gaps.slice(0, 20).join(', ')}`); process.exit(1); }
  list = missing.map((_, i) => list[String(i)]);
}
if (missing.length !== list.length) {
  console.error(`length mismatch: ${missing.length} English vs ${list.length} translations`);
  process.exit(1);
}
const path = `src/i18n/${lang}.json`;
const dict = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
missing.forEach((en, i) => { dict[en] = list[i]; });
const sorted = Object.fromEntries(Object.entries(dict).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(path, JSON.stringify(sorted, null, 1) + '\n');
console.log(`${lang}: added ${list.length}, total ${Object.keys(sorted).length}`);
