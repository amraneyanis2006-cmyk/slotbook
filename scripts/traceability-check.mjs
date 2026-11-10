// Release traceability check (Issue #8, step a): for every Test ID of sts.md, finds a test whose name starts with
// "<ID>:" in the listed file, and for every AC-01..AC-32 checks the AC → Test table of sts.md §5 in both directions.
// Usage: node scripts/traceability-check.mjs > artifacts/sprint-1/traceability-check.md   (exit 1 if a gap is found)
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url))); // every path below is relative to the repository root

const sts = readFileSync('docs/sprints/sprint-1/sts.md', 'utf8').split('\n');
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const unquote = (s) => s.replace(/`/g, '');

// Test rows: | ID | AC | Level | … | File | Result |
const tests = sts.filter((l) => /^\| (UNIT|API|DB|UI|E2E)-\d\d \|/.test(l)).map((l) => {
  const c = cells(l);
  return { id: c[0], acs: c[1].split(',').map((s) => s.trim()), file: unquote(c[c.length - 2]) };
});

// A test call at the start of a line whose first argument (string or template) starts with "<ID>:", comments removed.
// Any skip/only/todo/fixme/skipIf/runIf modifier, xit/xdescribe/xtest or runtime .skip() in the file counts as skipped.
const SKIP = /\.(skip|only|todo|fixme|skipIf|runIf)\b|\bx(it|describe|test)\(|\b\w+\.skip\(\)/;
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const found = tests.map((t) => {
  let src = '';
  try { src = stripComments(readFileSync(t.file, 'utf8')); } catch { return { ...t, name: '(file missing)', ok: false }; }
  const re = new RegExp(`^\\s*(?:it|test)\\(\\s*(['"\`])(${t.id}:[^'"\`]*)`, 'gm');
  const names = [...src.matchAll(re)].map((m) => m[2]);
  const skipped = SKIP.test(src);
  return { ...t, name: names.length ? names.join(' / ') : '(no test named with this ID)', ok: names.length > 0 && !skipped };
});

// AC → Test table (section 5): two AC/Tests pairs per row.
const acMap = new Map();
for (const l of sts.filter((x) => /^\| AC-\d\d \|/.test(x))) {
  const c = cells(l);
  for (let i = 0; i + 1 < c.length; i += 2) acMap.set(c[i], c[i + 1].split(',').map((s) => s.trim()));
}
const byId = new Map(found.map((t) => [t.id, t]));
// Every AC-01..AC-32 must be in §5; every test listed there must be found and name the AC on its row; every row
// naming the AC must be listed for it in §5.
const ALL_AC = Array.from({ length: 32 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);
const acs = ALL_AC.map((ac) => {
  const ids = acMap.get(ac) ?? [];
  const fromRows = found.filter((t) => t.acs.includes(ac)).map((t) => t.id);
  const ok = ids.length > 0 && ids.every((id) => byId.get(id)?.ok && byId.get(id).acs.includes(ac)) && fromRows.every((id) => ids.includes(id));
  return { ac, ids: ids.length ? ids : ['(missing in §5)'], ok };
});

const skipFiles = execSync('git ls-files server/tests client/tests e2e', { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter((f) => SKIP.test(stripComments(readFileSync(f, 'utf8'))));
const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

const out = [];
out.push('# Sprint 1 traceability check', '');
out.push(`Branch \`${branch}\`, commit \`${commit}\`, date ${new Date().toISOString()}, command \`node scripts/traceability-check.mjs\`.`, '');
out.push('A test counts as found when an `it(`/`test(` call at the start of a line (comments ignored) in the file listed by `sts.md` has a name starting with `<ID>:`, and that file contains no `.skip`, `.only`, `.todo`, `.fixme`, `.skipIf`, `.runIf`, `xit`, `xdescribe`, `xtest` or runtime `.skip()`. An AC is covered when it is in the §5 table, every test listed for it there is found and names the AC on its own row, and every row naming the AC is listed for it in §5. Whether the tests pass is recorded in `clean-clone-check.md` and in the "Result" column of `sts.md`.', '');
out.push(`## Test IDs (${found.filter((t) => t.ok).length}/${found.length} found)`, '');
out.push('| Test ID | AC | File | Test name(s) | Found |', '| :--- | :--- | :--- | :--- | :--- |');
for (const t of found) out.push(`| ${t.id} | ${t.acs.join(', ')} | \`${t.file}\` | ${t.name.replace(/\|/g, '\\|')} | ${t.ok ? 'yes' : 'NO'} |`);
out.push('', `## Acceptance criteria (${acs.filter((a) => a.ok).length}/${acs.length} covered)`, '');
out.push('| AC | Tests (sts.md §5) | Covered |', '| :--- | :--- | :--- |');
for (const a of acs) out.push(`| ${a.ac} | ${a.ids.join(', ')} | ${a.ok ? 'yes' : 'NO'} |`);
out.push('', '## Skipped or focused tests', '', skipFiles.length ? skipFiles.map((f) => `- \`${f}\``).join('\n')
  : 'None: no test file under `server/tests`, `client/tests` or `e2e` contains a skip/only/todo/fixme/skipIf/runIf modifier, `xit`/`xdescribe`/`xtest` or a runtime `.skip()`.');
const gaps = found.filter((t) => !t.ok).length + acs.filter((a) => !a.ok).length + skipFiles.length;
out.push('', `**Result:** ${gaps ? `${gaps} gap(s)` : 'no gap'}.`);
console.log(out.join('\n'));
process.exit(gaps ? 1 : 0);
