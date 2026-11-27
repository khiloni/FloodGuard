// Fails if the gzipped production bundle (JS + CSS + HTML in dist/) exceeds the budget,
// or if anything from the MSW mocks or the dev-only caniuse-lite data (CC BY 4.0) leaked into dist/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET = 300 * 1024;
// fileURLToPath, not URL.pathname: on Windows .pathname gives '/E:/...' which breaks fs calls.
const dist = fileURLToPath(new URL('../dist/', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let total = 0;
let langMax = 0;
const LANG_BUDGET = 40 * 1024;
const tooBig = [];
let leaked = [];
let caniuse = [];
for (const file of walk(dist)) {
  const buf = readFileSync(file);
  const gz = gzipSync(buf, { level: 9 }).length;
  // Language packs (src/i18n/<lang>.json) load only when that language is chosen: budget them apart.
  const isLangPack = /assets[\\/](hi|gu|mr|bn|ta|te|kn)-[\w-]+\.js$/.test(file);
  if (isLangPack) { langMax = Math.max(langMax, gz); if (gz > LANG_BUDGET) tooBig.push(file); } else total += gz;
  const text = buf.toString('utf8');
  if (/mockServiceWorker|msw\/browser|setupWorker|fixtures\/script/.test(text) || file.includes('mockServiceWorker')) leaked.push(file);
  if (/caniuse/i.test(text)) caniuse.push(file);
  console.log(`${(gz / 1024).toFixed(1).padStart(7)} KB gz  dist/${relative(dist, file).replace(/\\/g, '/')}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB gz  TOTAL (budget ${BUDGET / 1024} KB)`);
console.log(`${(langMax / 1024).toFixed(1).padStart(7)} KB gz  largest language pack, loaded on demand (budget ${LANG_BUDGET / 1024} KB each)`);
if (total > BUDGET || tooBig.length) { console.error('Over budget', tooBig); process.exit(1); }
if (leaked.length) {
  console.error('Mock code found in dist:', leaked);
  process.exit(1);
}
if (caniuse.length) {
  console.error('caniuse-lite data found in dist (dev-only, must not ship):', caniuse);
  process.exit(1);
}
console.log('No mock code and no caniuse data in dist.');
if (total > BUDGET) {
  console.error('Bundle over budget');
  process.exit(1);
}
