// Release check (F-18, MAN-03, AC-87, NFR-13). Fails (exit 1) when:
//  - a test file of server/tests, client/tests or e2e contains a skipped or focused test, or
//  - an AC of docs/traceability.md §6 has no test ID, or one of its test IDs has no test named "<ID>:" in the files
//    listed on its row (MAN-* IDs: the listed file must exist).
// Usage: bash scripts/release-check.sh   (writes the report to stdout)
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SKIP = /\.(skip|only|todo|fixme|skipIf|runIf)\b|\bx(it|describe|test)\(|\b\w+\.skip\(\)/;

const testFiles = execSync('git ls-files server/tests client/tests e2e', { encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|tsx)$/.test(f));
const skipped = testFiles.filter((f) => SKIP.test(stripComments(readFileSync(f, 'utf8'))));

const trace = readFileSync('docs/traceability.md', 'utf8');
const matrix = trace.slice(trace.indexOf('## 6.')).split('\n').filter((l) => /^\| AC-\d\d \|/.test(l));
const named = (file, id) => existsSync(file)
  && new RegExp(`^\\s*(?:it|test)\\(\\s*(['"\`])${id}:`, 'm').test(stripComments(readFileSync(file, 'utf8')));
const rows = matrix.map((l) => {
  const c = cells(l);
  const ids = c[4].split(',').map((s) => s.trim()).filter((s) => /^[A-Z0-9]+-\d\d$/.test(s));
  const files = c[5].replace(/`/g, '').split('<br>').map((s) => s.trim()).filter(Boolean);
  const missing = ids.filter((id) => (id.startsWith('MAN-') ? !files.some(existsSync) : !files.some((f) => named(f, id))));
  return { ac: c[0], ids, missing, ok: ids.length > 0 && missing.length === 0 };
});

const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const bad = rows.filter((r) => !r.ok);
const out = ['# Release check (MAN-03)', '', `Commit \`${commit}\`, ${new Date().toISOString()}, command \`bash scripts/release-check.sh\`.`, ''];
out.push(`- Test files scanned: ${testFiles.length}; files with a skipped or focused test: ${skipped.length}${skipped.length ? ` (${skipped.join(', ')})` : ''}.`);
out.push(`- ACs in traceability §6: ${rows.length}; ACs without a test ID or with a test ID not found: ${bad.length}.`, '');
if (bad.length) {
  out.push('| AC | Test IDs | Not found |', '| :--- | :--- | :--- |');
  for (const r of bad) out.push(`| ${r.ac} | ${r.ids.join(', ') || '(none)'} | ${r.missing.join(', ') || '—'} |`);
  out.push('');
}
const pass = skipped.length === 0 && bad.length === 0 && rows.length > 0;
out.push(`Result: **${pass ? 'PASS' : 'FAIL'}**`);
console.log(out.join('\n'));
process.exit(pass ? 0 : 1);
