// One-off codemod: wrap static English JSX text and aria-label/title/placeholder/alt attributes
// in tr('...') so they can be translated. Usage: node scripts/i18n-wrap.mjs src/components/Hud.tsx ...
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, dirname } from 'node:path';

const TEXT = />(\s*)([A-Z][A-Za-z0-9 ,.'’:;!?()\-/…%]*[A-Za-z.!?)…:])(\s*)</g;
const ATTR = /\b(aria-label|title|placeholder|alt)="([^"{}]*[A-Za-z][^"{}]*)"/g;
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

for (const file of process.argv.slice(2)) {
  let src = readFileSync(file, 'utf8');
  let n = 0;
  src = src.replace(TEXT, (m, a, text, b, off, all) => {
    const prev = all[off - 1];
    if (prev === '=' || prev === '-') return m; // arrow functions and generics
    if (/=>|&&|\|\||==/.test(text)) return m;
    n++;
    return `>${a}{tr(${q(text)})}${b}<`;
  });
  src = src.replace(ATTR, (m, attr, text) => { n++; return `${attr}={tr(${q(text)})}`; });
  if (n && !/import \{[^}]*\btr\b[^}]*\} from '[./]*lib\/i18n'/.test(src)) {
    const rel = relative(dirname(file), 'src/lib/i18n').replace(/\\/g, '/');
    const spec = rel.startsWith('.') ? rel : `./${rel}`;
    src = src.replace(/(^import [^\n]+\n)/, `$1import { tr } from '${spec}';\n`);
  }
  writeFileSync(file, src);
  console.log(`${file}: ${n} strings wrapped`);
}
