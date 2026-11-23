// Fails if the gzipped production bundle (JS + CSS + HTML in dist/) exceeds the budget,
// or if anything from the MSW mocks leaked into dist/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET = 300 * 1024;
const dist = new URL('../dist/', import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let total = 0;
let leaked = [];
for (const file of walk(dist)) {
  const buf = readFileSync(file);
  const gz = gzipSync(buf, { level: 9 }).length;
  total += gz;
  const text = buf.toString('utf8');
  if (/mockServiceWorker|msw\/browser|setupWorker|fixtures\/script/.test(text) || file.includes('mockServiceWorker')) leaked.push(file);
  console.log(`${(gz / 1024).toFixed(1).padStart(7)} KB gz  ${file.replace(dist, 'dist/')}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB gz  TOTAL (budget ${BUDGET / 1024} KB)`);
if (leaked.length) {
  console.error('Mock code found in dist:', leaked);
  process.exit(1);
}
if (total > BUDGET) {
  console.error('Bundle over budget');
  process.exit(1);
}
