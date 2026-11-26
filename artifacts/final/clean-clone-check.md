# Final clean-clone check (MAN-02, NFR-07) on `v1.0.0`

| Item | Value |
| :--- | :--- |
| Date | 2026-11-26, 06:47:39Z to 06:53:27Z |
| Cloned | `git clone --branch v1.0.0 https://github.com/amraneyanis2006-cmyk/slotbook.git` → `cdaf24f7f63c1c9e60e67f746b251f0cc5fdc6de` (the deployed commit) |
| Machine | Linux (Ubuntu 24.04 container of the Claude session); Node v22.23.4, npm 10, PostgreSQL 16.15 |
| Environment | Every command ran under `env -i HOME PATH` (no inherited `DATABASE_URL`, secret or test variable); `.env` copied from `.env.example`, only the two database names changed to throwaway databases `slotbook_release_check` and `slotbook_release_check_test` |
| Procedure | README "Setup" and "Tests", in order, in a fresh folder |

## Commands, exit codes and summaries

| # | Command | Exit | Summary |
| :--- | :--- | :--- | :--- |
| 1 | `git clone --branch v1.0.0 …` | 0 | `cdaf24f` |
| 2 | `createdb` of both throwaway databases (after `DROP DATABASE IF EXISTS`) | 0 | created |
| 3 | `npm run install:all` | 0 | root, server, client installed; Prisma client generated |
| 4 | `npm run db:migrate` | 0 | "All migrations have been successfully applied." (`0001` … `0006`) |
| 5 | `npm run db:seed` | 0 | "Created: 4 services, 6 users, 50 slots, 5 bookings" |
| 6 | `npm run db:seed` (second time) | 0 | "Created: 0 … Already present (updated): 4 services, 6 users, 50 slots, 5 bookings" (idempotent) |
| 7 | count query on `slotbook_release_check` | 0 | `6 users, 4 services, 50 slots, 5 bookings` |
| 8 | `npm run build` | 0 | server `tsc` and client `vite build` succeeded |
| 9 | `npm test` | 0 | server 32 files, **108 passed**; client 14 files, **21 passed**; 0 failed, 0 skipped |
| 10 | `npx playwright test` with a local config that only points Playwright at the container's Chrome (the bundled Chromium cannot be downloaded here); same specs and settings as `npm run test:e2e` | 0 | **22 passed**, 0 failed, 0 flaky (2.0 min) |
| 11 | `bash scripts/release-check.sh` | 0 | 75 test files, 0 skipped/focused; 87 ACs, 0 without a test found; **Result: PASS** |
| 12 | `git status --short` | 0 | only the 23 SHOT-01 screenshots (rewritten by every E2E run, as the README says) and `server/` + `client/package-lock.json` |

## Deviations and observations (recorded, not hidden)

- A first attempt at 06:42Z failed at `createdb` because the local PostgreSQL service was stopped; it was restarted and
  the whole procedure re-run from a new clone. A second attempt at 06:45Z inherited the session's `DATABASE_URL` from
  the shell, so it used the wrong databases; it was discarded and the run above uses `env -i`.
- In the run above, E2E-07 and E2E-08 first failed with "Executable doesn't exist" because `env -i` also removed the
  container's `PLAYWRIGHT_BROWSERS_PATH`; the whole E2E suite (step 10) was re-run with only that variable restored.
- `npm install` with npm 10 removes the `"libc"` fields that the newer npm on the developers' machines writes into the
  lock files (78 lines, metadata only, no version change). Use `npm ci` or the npm version of the team to keep the
  lock files unchanged.
