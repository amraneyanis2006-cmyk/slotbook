# F-00 — Platform Foundation (Sprint 1 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | NFR-07 (reproducible setup), NFR-10 (UTC storage), NFR-12 (deployable design), NFR-06 (safe errors — handler skeleton) |
| Issue / owner / reviewer | Issue #2 — Yanis Amrane (author), Simeon Audouit (reviewer) |
| Depends on | Contract PR (Issue #1) |
| Contract version | 1.4 (2026-11-14, Lab 5 Issue #25: §3 `/api/version`, §4 release footer, §6 AC-39; 1.3 2026-11-12, Lab 5 Issue #21: §3 graceful shutdown, §6 AC-38; 1.2 2026-11-11, Lab 5 Issue #20: §2 seed in production, §3 `/api/ready` and production serving, §6 AC-33..AC-37, §7) |

## 1. Behavior and Workflow

1. A developer clones the repository, copies `.env.example` to `.env` (root, read by the server), creates
   the `slotbook` and `slotbook_test` PostgreSQL databases and runs the documented commands.
2. `npm run install:all` installs root, server and client; `npm run db:migrate` applies all migrations;
   `npm run db:seed` loads the synthetic data; `npm run dev` starts the API (3000) and the SPA (5173,
   proxying `/api`).
3. `GET /api/health` reports the API and database state.

## 2. Data (migration `0001_init`)

Exactly the schema of `system-sds.md` §2: enums `Role`, `SlotStatus`, `BookingStatus`; models `User`,
`Service`, `Slot`, `Booking`, `Session` (`@@map("session")`). Raw SQL appended to the migration:

```sql
CREATE UNIQUE INDEX "booking_one_active_per_slot" ON "Booking" ("slotId") WHERE "status" = 'BOOKED';
ALTER TABLE "Slot" ADD CONSTRAINT "slot_end_after_start" CHECK ("endAt" > "startAt");
ALTER TABLE "Service" ADD CONSTRAINT "service_duration_valid"
  CHECK ("durationMin" BETWEEN 15 AND 120 AND "durationMin" % 15 = 0);
CREATE SEQUENCE "booking_ref_seq" START 1;
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

**Seed** (`server/prisma/seed.ts`, idempotent). With `NODE_ENV=production` it writes the data below only when
`SEED_DEMO_DATA=true` **and** `SEED_PASSWORD` is set (from Secret Manager): the demo accounts are needed for the
Lab 6 UAT. Without `SEED_DEMO_DATA=true` it exits without writing; the password is never printed. The Cloud
Run migration job keeps `SEED_DEMO_DATA=true` and runs on every release, so the **production seed is insert-only**:
services and users are created only when missing and an existing row is never updated (no password reset, no
`isActive` change); the demo slots and bookings are created only when the `Slot` table is empty (first run) and
skipped entirely otherwise. It prints the counts created and already present, never the password. Development and
test keep the update-in-place behaviour above (DB-02).

| Data | Content |
| :--- | :--- |
| Services | 3 active services + 1 inactive: Academic advising (30), Document request (15), Career counselling (45) — active; Thesis consultation (60) — **inactive** (for BR-06 tests). |
| Staff | `staff.anan@slotbook.test` (Anan Wong), `staff.mali@slotbook.test` (Mali Srisuk). |
| Customers | `cust.ploy@slotbook.test` (Ploy Chai), `cust.ken@slotbook.test` (Ken Tan), `cust.nina@slotbook.test` (Nina Park, **no bookings**), `cust.old@slotbook.test` (inactive). |
| Slots | For both staff, on Asia/Bangkok dates today−2..today+7 relative to the seed date, at **fixed local times** (09:00, 09:30, 10:00, 13:00, 14:00, …): open slots, booked slots, one CLOSED slot; past slots on today−1 and today−2 for Ken's COMPLETED and NO_SHOW bookings (inserted directly: BR-06 does not apply to seed data). Keyed by (`staffId`, `startAt`). |
| Bookings | Ploy: 1 BOOKED future, 1 CANCELLED; Ken: 1 BOOKED future, 1 COMPLETED past (today−1), 1 NO_SHOW past (today−2). References from `formatReference` with `booking_ref_seq`. Keyed by (`slotId`, `customerId`). |

All accounts use the password in `SEED_PASSWORD` (synthetic local value documented in the README).
**Idempotent** means: running the seed twice in a row gives the same counts of users, services, slots and
bookings (DB-02). Tests that need a slot starting within the next hour create it themselves.

## 3. API

| Method and path | Auth | Success | Failure |
| :--- | :--- | :--- | :--- |
| `GET /api/health` | public | `200 { "status": "ok", "database": "up" }` | `503 { "status": "degraded", "database": "down" }` |
| `GET /api/ready` | public | `200 { "status": "ready", "database": "connected" }` after `SELECT 1` | `503 { "status": "not_ready" }` |
| `GET /api/version` | public | `200 { "commit": APP_COMMIT or "local", "revision": K_REVISION or null }` (no database access) | — |

**Production mode** (`NODE_ENV=production`, one container): `trust proxy` is 1 (Cloud Run terminates TLS, so the
Secure cookie is set); Express serves the built SPA from `CLIENT_DIST` (default `client/dist` of the repository) and
returns `index.html` for every non-`/api` GET route; unknown `/api` routes stay the JSON 404. The server refuses to
start (message on stderr, exit 1) when `SESSION_SECRET` is missing, or in production shorter than 32 characters or
still the `.env.example` placeholder (`change-me…`). On SIGTERM (Cloud Run stop, `docker stop`) it closes the
server and exits 0.

Also provided as skeleton for every later feature: `app.ts` (JSON body limit 100 kB, session middleware,
routes, 404 JSON handler, error handler that maps `AppError(status, code, message, fields?)` and hides
everything else behind `500 INTERNAL_ERROR`), `utils/clock.ts` (`now()` replaceable in tests),
`utils/time.ts` (Asia/Bangkok ⇄ UTC helpers).

## 4. UI

App shell only: Vite + React + Router, `theme.css` tokens, a placeholder `/login` route (filled by F-01).
No domain screen. Every page ends with a footer `Release <first 7 characters of the commit>` read from
`GET /api/version`; no footer when the request fails (an image older than the endpoint).

## 5. Test Infrastructure

- Server: Vitest with `fileParallelism: false`; `tests/setup.ts` resets the test database
  (`prisma migrate reset --force --skip-generate` on `DATABASE_URL_TEST`, then seed) once per run;
  helpers `loginAs(agent, email)` and `freezeClock(iso)`.
- Client: Vitest + jsdom + Testing Library.
- E2E: Playwright (`baseURL http://localhost:5173`), `e2e/global-setup.ts` re-seeds the test database and
  creates the E2E-04/05/06 slot (Mali, today+10 at 15:00); viewports 1280, 768, 320.
- E2E data never collides with the seed: the seed covers today−2..today+7, E2E-03 uses Mali on today+9 at 14:00.

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-31 | `GET /api/health` returns 200 `{ status: "ok", database: "up" }` when PostgreSQL is reachable, without authentication. |
| AC-32 | Running the seed twice leaves the same number of users, services, slots and bookings, and the seeded accounts can be found by e-mail with their roles; no plaintext password is stored. |
| AC-33 | `GET /api/ready` returns 200 `{ status: "ready", database: "connected" }` when PostgreSQL answers `SELECT 1` and 503 `{ status: "not_ready" }` when it does not, without authentication. |
| AC-34 | In production the server serves the SPA with an `index.html` fallback for non-`/api` GET routes, unknown `/api` routes return the JSON 404, and login behind the HTTPS proxy sets the Secure session cookie. |
| AC-35 | In production the server exits with code 1 and a clear message, without listening, when `SESSION_SECRET` is missing, shorter than 32 characters or the `.env.example` placeholder. |
| AC-36 | In production the seed writes nothing unless `SEED_DEMO_DATA=true` and `SEED_PASSWORD` is set; with both it seeds; the password is never printed. |
| AC-37 | In production a rerun of the seed is insert-only: it changes no existing user, service, slot or booking (a changed password hash, a closed slot and a UAT booking stay as they are) and creates no booking when the database already has slots. |
| AC-38 | On SIGTERM the running server closes and exits with code 0 within seconds (it is PID 1 in the container, where SIGTERM has no default action). |
| AC-39 | `GET /api/version` returns 200 `{ commit, revision }` without authentication: `APP_COMMIT` and `K_REVISION` when set, otherwise `"local"` and `null`; the footer shows `Release <first 7 characters>` and nothing when the endpoint is missing. |

## 7. Failure / Boundary Cases

Database down → health 503 (no stack trace); seed in production without `SEED_DEMO_DATA=true` → exits
without writing (message, exit 0); with `SEED_DEMO_DATA=true` but no `SEED_PASSWORD` → error message, exit 1, no write;
production rerun (even on a later day) → no existing row changed, no demo slot or booking created, no unique
violation; database down → ready 503; missing/short `SESSION_SECRET` in production → no start (exit 1).
