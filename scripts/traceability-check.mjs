// Release traceability check (Issue #8, step a): for every Test ID of sts.md, finds a test whose name starts with
// "<ID>:" in the listed file, and for every AC of the AC → Test table, checks that each listed test was found.
// Usage: node scripts/traceability-check.mjs > artifacts/sprint-1/traceability-check.md   (exit 1 if a gap is found)
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const sts = readFileSync('docs/sprints/sprint-1/sts.md', 'utf8').split('\n');
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const unquote = (s) => s.replace(/`/g, '');

// Test rows: | ID | AC | Level | … | File | Result |
const tests = sts.filter((l) => /^\| (UNIT|API|DB|UI|E2E)-\d\d \|/.test(l)).map((l) => {
  const c = cells(l);
  return { id: c[0], acs: c[1].split(',').map((s) => s.trim()), file: unquote(c[c.length - 2]) };
});

// A test call whose first argument (string or template) starts with "<ID>:"; .skip/.only/.todo/.fixme anywhere count as skipped.
const SKIP = /\b(it|test|describe)\.(skip|only|todo|fixme)\b|\bx(it|describe)\(/;
const found = tests.map((t) => {
  let src = '';
  try { src = readFileSync(t.file, 'utf8'); } catch { return { ...t, name: '(file missing)', ok: false }; }
  const re = new RegExp(`\\b(?:it|test)\\(\\s*(['"\`])(${t.id}:[^'"\`]*)`, 'g');
  const names = [...src.matchAll(re)].map((m) => m[2]);
  const skipped = SKIP.test(src);
  return { ...t, name: names.length ? names.join(' / ') : '(no test named with this ID)', count: names.length, skipped, ok: names.length > 0 && !skipped };
});

// AC → Test table (section 5): two AC/Tests pairs per row.
const acMap = new Map();
for (const l of sts.filter((x) => /^\| AC-\d\d \|/.test(x))) {
  const c = cells(l);
  for (let i = 0; i + 1 < c.length; i += 2) acMap.set(c[i], c[i + 1].split(',').map((s) => s.trim()));
}
const byId = new Map(found.map((t) => [t.id, t]));
const acs = [...acMap.entries()].sort().map(([ac, ids]) => ({
  ac, ids, ok: ids.every((id) => byId.get(id)?.ok && byId.get(id).acs.includes(ac)),
}));

const skipFiles = execSync('git ls-files server/tests client/tests e2e', { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter((f) => SKIP.test(readFileSync(f, 'utf8')));
const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

const out = [];
out.push('# Sprint 1 traceability check', '');
out.push(`Branch \`${branch}\`, commit \`${commit}\`, date ${new Date().toISOString()}, command \`node scripts/traceability-check.mjs\`.`, '');
out.push('A test counts as found when a `it(`/`test(` call in the file listed by `sts.md` has a name starting with `<ID>:`, and the file contains no `.skip`, `.only`, `.todo`, `.fixme`, `xit` or `xdescribe`. Whether the tests pass is recorded in `clean-clone-check.md` and in the "Result" column of `sts.md`.', '');
out.push(`## Test IDs (${found.filter((t) => t.ok).length}/${found.length} found)`, '');
out.push('| Test ID | AC | File | Test name(s) | Found |', '| :--- | :--- | :--- | :--- | :--- |');
for (const t of found) out.push(`| ${t.id} | ${t.acs.join(', ')} | \`${t.file}\` | ${t.name.replace(/\|/g, '\\|')} | ${t.ok ? 'yes' : 'NO'} |`);
out.push('', `## Acceptance criteria (${acs.filter((a) => a.ok).length}/${acs.length} covered)`, '');
out.push('| AC | Tests (sts.md §5) | Every listed test found and lists this AC | ', '| :--- | :--- | :--- |');
for (const a of acs) out.push(`| ${a.ac} | ${a.ids.join(', ')} | ${a.ok ? 'yes' : 'NO'} |`);
out.push('', '## Skipped or focused tests', '', skipFiles.length ? skipFiles.map((f) => `- \`${f}\``).join('\n') : 'None: no test file under `server/tests`, `client/tests` or `e2e` contains `.skip`, `.only`, `.todo`, `.fixme`, `xit` or `xdescribe`.');
const gaps = found.filter((t) => !t.ok).length + acs.filter((a) => !a.ok).length + skipFiles.length;
out.push('', `**Result:** ${gaps ? `${gaps} gap(s)` : 'no gap'}.`);
console.log(out.join('\n'));
process.exit(gaps ? 1 : 0);
