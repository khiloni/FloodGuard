// Collects every English interface string and checks each language dictionary.
//   node scripts/i18n-extract.mjs          -> writes i18n-work/_source.json, reports missing per language
//   node scripts/i18n-extract.mjs --check  -> same, exits 1 if any language misses a string
// Sources: tr('...') calls, N_('...') data, the key dictionary `en` in lib/i18n.tsx, and the
// Flood Academy content (components/academy/content.ts).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const unq = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
const out = new Set();
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (!/mocks/.test(p)) walk(p); } else if (/\.(tsx|ts)$/.test(f)) files.push(p);
  }
})('src');

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\b(?:tr|N_)\(\s*'((?:\\.|[^'\\])*)'/g)) out.add(unq(m[1]));
  for (const m of src.matchAll(/\b(?:tr|N_)\(\s*"((?:\\.|[^"\\])*)"/g)) out.add(unq(m[1]));
}
// key dictionary (t('key')) in lib/i18n.tsx
const i18nSrc = readFileSync('src/lib/i18n.tsx', 'utf8');
const enBlock = i18nSrc.slice(i18nSrc.indexOf('const en: Dict = {'), i18nSrc.indexOf('};', i18nSrc.indexOf('const en: Dict = {')));
for (const m of enBlock.matchAll(/(\w+): '((?:\\.|[^'\\])*)'/g)) out.add(unq(m[2]));
// Academy content: every prose string
const content = readFileSync('src/components/academy/content.ts', 'utf8');
for (const m of content.matchAll(/'((?:\\.|[^'\\])*)'/g)) {
  const s = unq(m[1]);
  if (/[A-Za-z]/.test(s) && (/\s/.test(s) || /^[A-Z]/.test(s)) && !/^(river|city|dam|coast|island|mountain|after)$/.test(s)) out.add(s);
}
out.delete('');
const source = [...out].sort();
writeFileSync('i18n-work/_source.json', JSON.stringify(source, null, 1) + '\n');
console.log(`${source.length} English strings`);

let bad = 0;
for (const lang of ['hi', 'gu', 'mr', 'bn', 'ta', 'te', 'kn']) {
  const p = `src/i18n/${lang}.json`;
  const dict = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
  const missing = source.filter((s) => !dict[s]);
  const brace = source.filter((s) => dict[s] && (s.match(/\{\w+\}/g) || []).sort().join() !== (dict[s].match(/\{\w+\}/g) || []).sort().join());
  if (missing.length || brace.length) bad++;
  console.log(`${lang}: ${source.length - missing.length}/${source.length}${brace.length ? `, ${brace.length} with wrong {placeholders}: ${brace.slice(0, 3).join(' | ')}` : ''}`);
  if (process.argv.includes('--missing') && missing.length) writeFileSync(`i18n-work/_missing.${lang}.json`, JSON.stringify(missing, null, 1));
}
if (process.argv.includes('--check') && bad) process.exit(1);
