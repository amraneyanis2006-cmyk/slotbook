# Sprint 1 clean-clone check (MAN-02) and secrets scan

| Item | Value |
| :--- | :--- |
| Date | 2026-11-10, 07:54:02Z to 07:56:29Z |
| Cloned | `https://github.com/amraneyanis2006-cmyk/slotbook.git`, branch `release/sprint-1`, commit `e5af45c` (the README fixes of this Issue) |
| Machine | Windows 11, Git Bash; Node v24.19.0, npm 12.2.0, PostgreSQL 18.4 |
| Databases | Throwaway `slotbook_release_check` (the `DATABASE_URL`) and `slotbook_release_check_test` (the `DATABASE_URL_TEST`; the test setup only accepts a name ending in `_test`). Both were created by the `slotbook` role and dropped after the check (`dropdb`, exit 0 for both). |
| Procedure | `README.md` "Setup" and "Tests", in order, in a fresh temporary folder. Deviations from the README: step 1 (`psql -U postgres … CREATE ROLE …`) was not run, because the `slotbook` role already exists on this machine, so the role created the two throwaway databases instead of the README names; `.env` came from `.env.example` with only the two database names changed; `npm run dev` was not started, since `npm run test:e2e` starts the API and the app itself. The run used `release/sprint-1`, which differs from `sprint-1-staging` only by this Issue's docs and the `install:all` change. Later commits only changed Markdown, the traceability script and its output. |

## Commands, exit codes and summaries

| # | Command | Exit | Summary |
| :--- | :--- | :--- | :--- |
| 1 | `git clone -b release/sprint-1 https://github.com/amraneyanis2006-cmyk/slotbook.git slotbook-clean` | 0 | Cloned `e5af45c` |
| 2 | `node -v && npm -v && psql --version` | 0 | v24.19.0, 12.2.0, 18.4 |
| 3 | `createdb -U slotbook -h localhost slotbook_release_check && createdb -U slotbook -h localhost slotbook_release_check_test` (after `dropdb --if-exists` of both) | 0 | Both databases created |
| 4 | `cp .env.example .env`, then change the database names in `DATABASE_URL` and `DATABASE_URL_TEST` | 0 | `.env` points at the throwaway databases; the other values are the synthetic ones from `.env.example` |
| 5 | `npm run install:all` | 0 | 30 + 196 + 166 packages. npm 12 warns that install scripts were blocked: 5 in `server/` (prisma, @prisma/client, @prisma/engines, bcrypt, esbuild) and 1 in `client/` (esbuild). `npm run db:generate` then generated the Prisma client in `server/` |
| 6 | `ls server/node_modules/.prisma/client/index.js && test ! -d node_modules/.prisma` | 1 | The client is in `server/node_modules/.prisma` (the one the server uses). The check failed only on its second half: the server's own `postinstall` also writes an unused copy to the root `node_modules/.prisma`. Harmless: steps 8 to 13 use the `server/` copy |
| 7 | `npx playwright install chromium` | 0 | Chromium already present for this Playwright version |
| 8 | `npm run db:migrate` | 0 | "All migrations have been successfully applied." (`0001_init`) |
| 9 | `npm run db:seed` | 0 | "Seed complete." |
| 10 | `npm run db:seed` (second time) | 0 | "Seed complete." |
| 11 | `psql -U slotbook -h localhost -d slotbook_release_check -At -f counts.sql` | 0 | `6 users, 4 services, 50 slots, 5 bookings`. The first attempt (exit 1) had a quoting error in the check query itself; it was corrected and rerun |
| 12 | `npm run db:seed` (third time), then the same count query | 0, 0 | Same counts: `6 users, 4 services, 50 slots, 5 bookings` (idempotent) |
| 13 | `npm run build` | 0 | Server `tsc` and client `vite build` succeeded (`dist/assets/index-*.js` 189.24 kB) |
| 14 | `npm test` | 0 | Server: 12 test files, **56 passed**, 0 failed, 0 skipped. Client: 4 test files, **7 passed**, 0 failed, 0 skipped |
| 15 | `npm run test:e2e` | 0 | **9 passed**, 0 failed, 0 skipped, 0 flaky (1 worker, 43.3 s): E2E-01..E2E-08 and SHOT-01 |
| 16 | `git status --short` | 0 | Only `artifacts/sprint-1/screenshots/*.png` changed (12 files), because SHOT-01 rewrites them on every run, as the README says. Nothing else changed |

`counts.sql` = `SELECT (SELECT count(*) FROM "User") || ' users, ' || (SELECT count(*) FROM "Service") || ' services, ' || (SELECT count(*) FROM "Slot") || ' slots, ' || (SELECT count(*) FROM "Booking") || ' bookings';`

**Result: the README setup works on a clean clone.** Every README command that was run exited 0, and all suites
passed: server 56/56, client 7/7, Playwright 9/9. The two non-zero exits above came from the extra checks of
this procedure, not from a README command.

## README and setup defects found and fixed in this Issue

They were found on this machine before the check (Issue #8 extras a to f), fixed in `README.md` and `package.json`, and verified by the run above:

1. **No step created the `slotbook` role and databases,** and nothing explained PostgreSQL authentication (`createdb` failed with `fe_sendauth: no password supplied`).
   - Fix: a `psql -U postgres` block with `CREATE ROLE slotbook … CREATE DATABASE … OWNER slotbook`.
2. **The Prisma client was generated into the root `node_modules`,** so `db:seed` failed with `Cannot find module '@prisma/client/runtime/library.js'`.
   - Cause: when `npm install --prefix server` runs the server's `postinstall` (`prisma generate`), Prisma writes the client to the root folder (seen on npm 12; the exact Prisma path logic was not investigated).
   - Fix: `install:all` now ends with the new `npm run db:generate`, which runs `prisma generate` inside `server/` (step 5).
3. **`npx playwright install chromium` and `npm test` were missing** from the Setup block. Both are added.
4. **Versions are unified** as "Node 20 or newer (tested with 20 and 24), PostgreSQL 16 or newer (tested with 16 and 18)", in the README and `system-sds.md` (and in the team's rule file, which is not committed).
5. **`npm audit fix` (without `--force`)** was run in `server/` and `client/` and changed nothing: every remaining advisory needs a major upgrade (vitest 5, zod 4, react-router-dom 7). They are listed under "Known limitations" in the README, and the root package has none.
6. **The README now explains** that npm 12 blocks install scripts (with the warning text and why the project still works), and that `npm run test:e2e` rewrites the committed screenshots.

## Secrets scan (step c)

Run on `release/sprint-1` in the working repository on 2026-11-10. The values of the local `.env` were passed to `git grep` from the shell and are not written here.

| # | Command | Result |
| :--- | :--- | :--- |
| 1 | `git grep -c -F "<SEED_PASSWORD value of the local .env>"` | exit 1: no tracked file contains it |
| 2 | `git log --all --oneline -S"<SEED_PASSWORD value of the local .env>"` | no commit ever added or removed it |
| 3 | `git grep -c -F "<SESSION_SECRET value of the local .env>"` and `git log --all -S…` | exit 1 / no commit |
| 4 | `git ls-files \| grep -E "(^\|/)\.env"` | only `.env.example` is tracked |
| 5 | `git log --all --format=%H -- .env` | empty: `.env` was never committed |
| 6 | `.gitignore` | ignores `.env` and `.env.*`, and keeps `!.env.example` |
| 7 | `git grep -n -E "SEED_PASSWORD\s*[=:]"` | only `.env.example:7 SEED_PASSWORD=slotbook-dev-password` (synthetic, documented in the README) |
| 8 | `git grep -n -i "password" -- ':!*.md' ':!*.png' ':!*.txt'` | Every hit is one of: field names (`password`, `passwordHash`); reads of `process.env.SEED_PASSWORD` (seed, tests, E2E helpers); validation messages; or obviously fake test inputs (`not-the-password`, `whatever`, `x`, `wrong-password`, `right-password`, `'p'.repeat(129)`). The seed stores only bcrypt hashes (DB-02 checks that no column equals `SEED_PASSWORD`) |
| 9 | `git grep -n -i -E "slotbook-dev-password\|PASSWORD 'slotbook'\|slotbook:slotbook"` | `.env.example`, `README.md` and `system-sds.md` §7: the documented synthetic local role password and seed password, no real credential |

**Result: no secret, real password or `.env` file is committed.**
