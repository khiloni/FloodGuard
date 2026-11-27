// Lists English UI text that is not yet wrapped in tr()/N_(): JSX text and string literals of
// two or more words. Usage: node scripts/i18n-scan.mjs  (prints file:line: text)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (!/mocks|i18n$/.test(p)) walk(p); } else if (/\.(tsx|ts)$/.test(f) && !/i18n\.tsx|content\.ts|vite-env/.test(f)) files.push(p);
  }
})('src');

const IGNORE = /className|data-testid|import |from '|console\.|aria-hidden|viewBox|d="|fill=|stroke|transform|translate\(|https?:|\.json|localStorage|addEventListener|querySelector|matchMedia|Error\(/;
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line) || IGNORE.test(line) && !/>[^<]*[a-z]{3,} [a-z]/.test(line)) return;
    const stripped = line.replace(/tr\((['`])(?:\\.|(?!\1).)*\1[^)]*\)/g, '').replace(/N_\('(?:\\.|[^'])*'\)/g, '').replace(/t\('[a-zA-Z]+'\)/g, '');
    const hits = [];
    for (const m of stripped.matchAll(/'([A-Za-z][^'{}]*\s[^'{}]*[a-z][^'{}]*)'/g)) hits.push(m[1]);
    for (const m of stripped.matchAll(/`([^`]*[A-Za-z]{3,} [A-Za-z]{2,}[^`]*)`/g)) hits.push(m[1]);
    for (const m of stripped.matchAll(/>\s*([^<>{}=]*[a-z]{2,} [a-z]{2,}[^<>{}]*)</g)) hits.push(m[1]);
    for (const m of stripped.matchAll(/}\s+([a-z][a-z ,.()']{3,})\s*</g)) hits.push(m[1]);
    const real = hits.filter((h) => !/^[\w-]+$/.test(h) && !/\$\{[^}]+\}-|^\s*$|var\(|rgba|px|%\)|^[a-z-]+ [a-z-]+$/.test(h) || /\b(the|and|of|to|in|is|are|for|people|water)\b/.test(h));
    if (real.length) console.log(`${f}:${i + 1}: ${real.join(' | ')}`);
  });
}
