# Sprint 1 — Software Test Specification (STS)

Version 1.4 (2026-11-12). Each test name in code **starts with its Test ID** (e.g.
`it('API-15: books a bookable slot …')`). Test databases are reset and seeded before each run; time-based
rules use `freezeClock()` (server) or slots created relative to the real clock (E2E). The "Result" column
is filled from the real release run (Part F of the Deliverable 1 submission PDF): the clean-clone run of 2026-11-10 at
commit `e5af45c` (`npm test` and `npm run test:e2e`; every Test ID below passed; see `artifacts/sprint-1/clean-clone-check.md`). Rows marked "Lab 5, #20" come from the Issue #20 PR run.

Levels: **Unit** = pure function, no DB · **API** = Supertest against the Express app + test PostgreSQL ·
**DB** = direct Prisma/SQL on the test database · **UI** = component test (Vitest + Testing Library,
mocked fetch) · **E2E** = Playwright against the running app.

## 1. Unit Tests — `server/tests/unit/`

| Test ID | AC | Level | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UNIT-01 | AC-12 | Unit | Clock 2026-11-10 08:00 Bangkok; inputs: past start, 09:10, 07:45, 17:45 + 30 min, inactive service, past **and** outside opening hours (2026-11-09 07:00), valid 09:30 | `validateSlot(input, service, now)` | Errors on `startTime`/`serviceId` for each invalid input with the specified messages; past + outside hours → only "The slot must start in the future." (F-03 §2 check order); valid input → `{ startAt, endAt }` with end = start + duration; 17:30 + 30 min (ends 18:00) valid | `server/tests/unit/slotRules.test.ts` | Pass |
| UNIT-02 | AC-13 | Unit | Existing own slots 09:00–09:30 (OPEN), 10:00–10:30 (CANCELLED) | `overlaps(a, b)` / `findOverlap(new, existing)` | 09:15–09:45 overlaps; 09:30–10:00 does not (touching); 10:00–10:30 ignored because CANCELLED | `server/tests/unit/slotRules.test.ts` | Pass |
| UNIT-03 | AC-17 | Unit | year 2026, seq 15 / seq 1234567 | `formatReference(year, seq)` | `BK-2026-000015`; seq > 999999 throws | `server/tests/unit/bookingRules.test.ts` | Pass |
| UNIT-04 | AC-20, AC-21 | Unit | Clock fixed; slots at +60 min, +59 min, CLOSED, inactive service; customer with 2 / 3 active future bookings; overlapping and back-to-back bookings | `isBookable`, `checkCustomerLimits` | +60 bookable, +59, CLOSED and inactive service → `SLOT_NOT_BOOKABLE`; 3 active → `BOOKING_LIMIT_REACHED`; past bookings are excluded by the service query (slot start > now) and the pure rule ignores bookings that are not BOOKED (CANCELLED, COMPLETED, NO_SHOW), while the query part is checked by API-19; overlap → `BOOKING_OVERLAP`; back-to-back → null | `server/tests/unit/bookingRules.test.ts` | Pass |
| UNIT-05 | AC-26 | Unit | Bookings BOOKED at +120 min, +119 min; CANCELLED; COMPLETED; NO_SHOW | `canCustomerCancel` | +120 → null; +119 → `CANCELLATION_WINDOW_CLOSED`; CANCELLED/COMPLETED/NO_SHOW → `BOOKING_NOT_ACTIVE` (checked first) | `server/tests/unit/bookingRules.test.ts` | Pass |
| UNIT-06 | AC-01 | Unit | — | `sessionOptions('production')`, `sessionOptions('development')` from `server/src/config/session.ts` | production: `cookie.secure` true, `cookie.httpOnly` true, `cookie.sameSite` `'lax'`, `cookie.maxAge` 8 h, `rolling` true; development: `cookie.secure` false | `server/tests/unit/sessionConfig.test.ts` | Pass |
| UNIT-07 | AC-35 | Unit | `NODE_ENV=production` | Start `src/index.ts` as a child process with `SESSION_SECRET` unset, 31 characters, then the `.env.example` placeholder | Exit code 1, stderr "Refusing to start: SESSION_SECRET …", never listens | `server/tests/unit/sessionConfig.test.ts` | Pass (Lab 5, #20) |
| UNIT-08 | AC-38 | Unit | `NODE_ENV=production`, valid secret, `PORT=0` | Start `src/index.ts` as a child process, wait for "listening", send SIGTERM | Exit code 0 within 5 s (not killed by the signal) | `server/tests/unit/sessionConfig.test.ts` | Pass (Lab 5, #21) |

## 2. API / Database Integration Tests — `server/tests/api/`, `server/tests/db/`

| Test ID | AC | Level | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| API-01 | AC-01 | API | Seeded active Customer | `POST /api/auth/login` valid credentials (upper-case e-mail variant too) | 200 `{ user: { id, name, email, role } }`, no `passwordHash`/`isActive`; `Set-Cookie` has `HttpOnly` and `SameSite=Lax` | `server/tests/api/auth.api.test.ts` | Pass |
| API-02 | AC-02 | API | Seeded users | Login with wrong password; unknown e-mail | Both 401 `INVALID_CREDENTIALS`, identical message; following `/me` with that agent → 401 | `server/tests/api/auth.api.test.ts` | Pass |
| API-03 | AC-02 | API | Seeded inactive Customer; active user deactivated after login | Login inactive; call `/me` after deactivation | Login 401 `INVALID_CREDENTIALS` (same message); existing session → 401 `UNAUTHENTICATED` | `server/tests/api/auth.api.test.ts` | Pass |
| API-04 | AC-03 | API | Logged-in Staff; anonymous agent | `GET /api/auth/me` | 200 current user with role `STAFF`; anonymous 401 `UNAUTHENTICATED` | `server/tests/api/auth.api.test.ts` | Pass |
| API-05 | AC-04 | API | Logged-in Customer, cookie saved | `POST /api/auth/logout`, then reuse the saved cookie on `/me` and `GET /api/services` | 204; both later calls 401 | `server/tests/api/auth.api.test.ts` | Pass |
| API-06 | AC-06 | API | `PROTECTED_ROUTES` table (grows with each Issue) | Call every route without a cookie | 401 `UNAUTHENTICATED`, body keys exactly `error`, `message` | `server/tests/api/access.api.test.ts` | Pass |
| API-07 | AC-07 | API | Logged-in Customer and Staff; role-restricted rows added in Issue #4 (staff endpoints) and Issue #5 (customer endpoints) | Call every role-restricted route with the other role | 403 `FORBIDDEN`, body keys exactly `error`, `message` | `server/tests/api/access.api.test.ts` | Pass |
| API-08 | AC-08 | API | Staff Anan logged in; Customer Ploy logged in | `POST /api/staff/slots` with `staffId` of Mali; `POST /api/bookings` with `customerId` of Ken (slot part in Issue #4, booking part in Issue #5) | Slot stored with Anan's id; booking stored for Ploy | `server/tests/api/access.api.test.ts` | Pass |
| API-09 | AC-09 | API | Test-only route that throws (mounted when `NODE_ENV=test`) and a Prisma error | Call it | 500 `{ error: "INTERNAL_ERROR", message }`, no `stack`, SQL keyword or file path in the body | `server/tests/api/access.api.test.ts` | Pass |
| API-10 | AC-11 | API | Staff Anan, clock fixed | `POST /api/staff/slots` valid; then `GET /api/staff/slots` | 201, DB row with `staffId` Anan, OPEN, `endAt` = start + duration; slot listed | `server/tests/api/slots.api.test.ts` | Pass |
| API-11 | AC-12 | API | Staff Anan | Post past, 09:10, 07:45, 17:45 (30 min), inactive service, missing fields | Each 422 `VALIDATION_ERROR` with the expected `fields` key; slot count unchanged | `server/tests/api/slots.api.test.ts` | Pass |
| API-12 | AC-13 | API | Anan has 09:00–09:30 | Post 09:15 (Anan); 09:15 (Mali); 09:30 (Anan); two overlapping posts in parallel | 409 `SLOT_OVERLAP`; 201; 201; parallel → one 201 + one 409 | `server/tests/api/slots.api.test.ts` | Pass |
| API-13 | AC-14 | API | Anan and Mali have slots, one of Anan's booked, one past, one cancelled | `GET /api/staff/slots` as Anan | Only Anan's upcoming non-cancelled slots, ordered; booked one has `booking.reference` + customer name | `server/tests/api/slots.api.test.ts` | Pass |
| API-14 | AC-16 | API | Clock fixed; day with OPEN (free), booked, CLOSED, +30 min, inactive-service slots | `GET /api/slots/available?date=` with/without `serviceId`; as Staff | Only bookable slots, ordered, filtered by service, no customer data; Staff → 403; bad date → 422 | `server/tests/api/bookings.api.test.ts` | Pass |
| API-15 | AC-17 | API | Ploy, bookable slot | `POST /api/bookings { slotId, note }`; then available list | 201 BOOKED, reference `^BK-\d{4}-\d{6}$`, owner Ploy in DB; slot absent from available | `server/tests/api/bookings.api.test.ts` | Pass |
| API-16 | AC-18 | API | Slot booked by Ken | Ploy books it | 409 `SLOT_ALREADY_BOOKED`; DB has exactly 1 BOOKED booking for the slot | `server/tests/api/bookings.api.test.ts` | Pass |
| API-17 | AC-19 | API | Free slot; Ploy and Nina logged in | Both `POST /api/bookings` in `Promise.all` | Status codes sorted = [201, 409]; 1 BOOKED row | `server/tests/api/bookings.api.test.ts` | Pass |
| API-18 | AC-20 | API | Slot starting in 30 min; CLOSED slot; slot of the inactive service; slotId 999999 | Ploy books each | 409 `SLOT_NOT_BOOKABLE` ×3, 404 `NOT_FOUND`; no booking stored | `server/tests/api/bookings.api.test.ts` | Pass |
| API-19 | AC-21 | API | Nina with 3 active future bookings; Ploy with a booking 10:00–10:30 | Nina books a 4th; Ploy books another staff's 10:15 slot | 409 `BOOKING_LIMIT_REACHED`; 409 `BOOKING_OVERLAP`; nothing stored | `server/tests/api/bookings.api.test.ts` | Pass |
| API-20 | AC-23 | API | Ploy and Ken with bookings | `GET /api/bookings/mine` and `GET /api/bookings/:ref` as Ploy; log out, log in again, repeat | Only Ploy's bookings, correct split/order; same data after re-login | `server/tests/api/my-bookings.api.test.ts` | Pass |
| API-21 | AC-24 | API | Ken's booking reference | Ploy `GET` and `POST …/cancel` on it | Both 404 `NOT_FOUND`, no booking fields in body; Ken's booking still BOOKED | `server/tests/api/my-bookings.api.test.ts` | Pass |
| API-22 | AC-25 | API | Ploy's booking at +3 h | Cancel; then Nina lists available and books the slot | 200 CANCELLED + `cancelledAt`; slot listed again; Nina 201 | `server/tests/api/my-bookings.api.test.ts` | Pass |
| API-23 | AC-26 | API | Ploy's booking at +90 min; a CANCELLED, a COMPLETED and a NO_SHOW booking | Cancel each | 409 `CANCELLATION_WINDOW_CLOSED`, 409 `BOOKING_NOT_ACTIVE` ×3; rows unchanged | `server/tests/api/my-bookings.api.test.ts` | Pass |
| API-24 | AC-28 | API | Anan and Mali slots on a date, some booked | `GET /api/staff/schedule?date=` as Anan; as Ploy; bad date | Only Anan's slots with reference, customer, note and correct summary `{ total, booked, open, closed }` (total = booked + open + closed); Ploy 403; 422 | `server/tests/api/schedule.api.test.ts` | Pass |
| API-25 | AC-31 | API | DB up | `GET /api/health` without session | 200 `{ status: "ok", database: "up" }` | `server/tests/api/health.api.test.ts` | Pass |
| API-26 | AC-33 | API | DB up, then `prisma.$queryRaw` rejected once (DB unreachable) | `GET /api/ready` without session, twice | 200 `{ status: "ready", database: "connected" }`, no cookie; then 503 `{ status: "not_ready" }` | `server/tests/api/health.api.test.ts` | Pass (Lab 5, #20) |
| API-27 | AC-34 | API | `NODE_ENV=production`, 32-char secret, `CLIENT_DIST` = temporary build; then not production | `GET /`, `/login`, `/bookings/42`, `/assets/app.js`, `/api`, `/api/nope`; `POST /api/auth/login` with `X-Forwarded-Proto: https` | `index.html` for the routes, JS for the asset, JSON 404 `NOT_FOUND` for `/api…`, `sid` cookie with `Secure`; outside production `/bookings/42` is 404 | `server/tests/api/production.api.test.ts` | Pass (Lab 5, #20) |
| DB-01 | AC-19 | DB | Free slot | Insert two `BOOKED` bookings for the slot directly with Prisma | Second insert fails with unique violation `P2002` on `booking_one_active_per_slot`; a second `CANCELLED` row is allowed | `server/tests/db/constraints.db.test.ts` | Pass |
| DB-02 | AC-32 | DB | Fresh test DB, `NODE_ENV=test` | Run the seed twice | Same counts after both runs; seeded e-mails present with roles; every `passwordHash` starts with `$2` and no column equals `SEED_PASSWORD` | `server/tests/db/seed.db.test.ts` | Pass |
| DB-03 | AC-36 | DB | `NODE_ENV=production`; a Prisma client that fails on any use | Seed with `SEED_DEMO_DATA` unset, `''`, `false`, `1`; then `true` without `SEED_PASSWORD`; then the real `prisma/seed.ts` command with `SEED_DEMO_DATA=false` and `true` on the test DB | `'skipped'` without touching Prisma; error "SEED_PASSWORD is not set" without touching Prisma; command prints "Seed skipped" (exit 0), then on the seeded DB "Seed complete. Created: 0 services, 0 users, 0 slots, 0 bookings. Already present (left unchanged): 4 services, 6 users, 50 slots, 5 bookings." (exit 0); the password is in neither stdout nor stderr | `server/tests/db/seed.db.test.ts` | Pass (Lab 5, #20) |
| DB-04 | AC-37 | DB | Seeded test DB; Nina's `passwordHash` changed, Anan today+3 09:00 slot CLOSED, Anan today+2 09:00 booked by Nina (the slot a next-day seed books for Ploy) | `NODE_ENV=production`, `SEED_DEMO_DATA=true`: `seed(prisma, today+1)` (the next release a day later); rows restored afterwards | Same counts of users, services, slots and bookings; hash, CLOSED status and Nina's BOOKED booking unchanged; no other booking on that slot (no P2002) | `server/tests/db/seed.db.test.ts` | Pass (Lab 5, #20) |

## 3. UI Component Tests — `client/tests/`

| Test ID | AC | Level | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UI-01 | AC-05 | UI | Mocked `/api/auth/login` 200 / 401 | Fill and submit the login form | Labels present; button disabled while pending; 401 → alert with message, e-mail kept, password cleared; 200 → navigate to role home | `client/tests/LoginPage.test.tsx` | Pass |
| UI-02 | AC-15 | UI | Mocked services, slots, 422 and 201 responses | Render My Slots, submit invalid then valid | Loading skeleton (`aria-busy`), field error under Start time, success toast and refreshed list; empty state text | `client/tests/MySlotsPage.test.tsx` | Pass |
| UI-03 | AC-22 | UI | Mocked available slots, 201 and 409 | Open dialog, confirm | Dialog focus trap + Esc; 201 → reference shown; 409 → message in dialog and list re-fetched; empty state text | `client/tests/BookSlotPage.test.tsx` | Pass |
| UI-04 | AC-27 | UI | Mocked `mine` with upcoming/past, cancel 200 | Render, cancel | Two sections; Cancel only for cancellable booking; after confirm the badge shows Cancelled | `client/tests/MyBookingsPage.test.tsx` | Pass |

## 4. End-to-End Tests — `e2e/`

| Test ID | AC | Level | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E2E-01 | AC-05, AC-04 | E2E | Seeded accounts | Customer logs in → `/book`, header name; logs out; Staff logs in → `/staff/slots`; wrong password | Correct landing pages and header; logout → `/login`, back button does not show data; error message on wrong password | `e2e/auth.spec.ts` | Pass |
| E2E-02 | AC-10 | E2E | Seeded accounts | Anonymous opens `/bookings`; Customer opens `/staff/slots`; Staff opens `/book` | Redirects to `/login`, `/book`, `/staff/slots` respectively | `e2e/auth.spec.ts` | Pass |
| E2E-03 | AC-15 | E2E | Staff Mali | Publish a slot on today+9 at 14:00 (outside the seed range); try an overlapping one | New slot listed; overlap message shown | `e2e/staff-slots.spec.ts` | Pass |
| E2E-04 | AC-22, AC-17 | E2E | Free Mali slot on today+10 at 15:00 created by `e2e/global-setup.ts` (independent of E2E-03) | Ploy filters that date, books it with a note | Reference shown; slot gone from the list | `e2e/booking-journey.spec.ts` | Pass |
| E2E-05 | AC-27, AC-23, AC-25 | E2E | Booking from E2E-04 | Ploy opens My Bookings, reloads, logs out/in, opens detail, cancels | Booking persisted across reload and re-login; after cancel badge Cancelled and slot bookable again on `/book` | `e2e/booking-journey.spec.ts` | Pass |
| E2E-06 | AC-29 | E2E | Ploy books the global-setup Mali slot (today+10 15:00). Depends on E2E-05, which cancels the E2E-04 booking on that slot: Playwright runs with one worker and `schedule.spec.ts` after `booking-journey.spec.ts` | Mali opens Schedule for that day; Anan opens the same day | Mali sees reference + "Ploy Chai"; Anan does not | `e2e/schedule.spec.ts` | Pass |
| E2E-07 | AC-30 | E2E | Each S1 page per role | Load at 320×800, 768×1024, 1280×900 | `document.documentElement.scrollWidth <= clientWidth`; main buttons visible | `e2e/responsive-a11y.spec.ts` | Pass |
| E2E-08 | AC-30 | E2E | Customer account | Log in and book using only Tab/Shift+Tab/Enter/Esc | Booking succeeds; focused elements have a visible outline | `e2e/responsive-a11y.spec.ts` | Pass |

## 5. AC → Test Coverage (all Sprint 1 AC)

| AC | Tests | AC | Tests |
| :--- | :--- | :--- | :--- |
| AC-01 | API-01, UNIT-06 | AC-17 | UNIT-03, API-15, E2E-04 |
| AC-02 | API-02, API-03 | AC-18 | API-16 |
| AC-03 | API-04 | AC-19 | API-17, DB-01 |
| AC-04 | API-05, E2E-01 | AC-20 | UNIT-04, API-18 |
| AC-05 | UI-01, E2E-01 | AC-21 | UNIT-04, API-19 |
| AC-06 | API-06 | AC-22 | UI-03, E2E-04 |
| AC-07 | API-07 | AC-23 | API-20, E2E-05 |
| AC-08 | API-08 | AC-24 | API-21 |
| AC-09 | API-09 | AC-25 | API-22, E2E-05 |
| AC-10 | E2E-02 | AC-26 | UNIT-05, API-23 |
| AC-11 | API-10 | AC-27 | UI-04, E2E-05 |
| AC-12 | UNIT-01, API-11 | AC-28 | API-24 |
| AC-13 | UNIT-02, API-12 | AC-29 | E2E-06 |
| AC-14 | API-13 | AC-30 | E2E-07, E2E-08 |
| AC-15 | UI-02, E2E-03 | AC-31 | API-25 |
| AC-16 | API-14 | AC-32 | DB-02 |
| AC-33 | API-26 | AC-34 | API-27 |
| AC-35 | UNIT-07 | AC-36 | DB-03 |
| AC-37 | DB-04 | AC-38 | UNIT-08 |

**Manual checks** (supplement only, recorded in Part F of the Deliverable 1 submission PDF, never replacing a test above): MAN-01 visual
review of the five screens against `system-sds.md` §3; MAN-02 clean-clone setup following the README.

## 6. TDD Evidence Rule

For every implementation Issue (#2–#7) the tests of that Issue are committed first
(`test(<F-xx>): … [red]`), run, and their failing output saved to `artifacts/sprint-1/tdd/issue-<n>-red.txt`;
the implementation commit follows and the passing output is saved to
`artifacts/sprint-1/tdd/issue-<n>-green.txt`. Each file starts with a header (branch, commit hash, date,
command). The rule tests (UNIT-01/02/04/05, API-12, API-16..19, API-21..23) must appear failing in the red
file of their Issue. For E2E-07/08, which are cross-cutting, the red step only covers the screen added by the Issue.

## 7. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-07 | Yanis Amrane | Initial STS for Sprint 1 (reviewed by Simeon in the contract PR). |
| 1.1 | 2026-11-07 | Yanis Amrane | UNIT-06 added; UNIT-01/04, API-07/08/18/24, E2E-03/04/06 updated; full paths; TDD file naming; see PR #9. |
| 1.2 | 2026-11-10 | Simeon Audouit | Decisions by Yanis Amrane for Issue #8: UNIT-04 states that the query excludes the past and the rule ignores non-BOOKED bookings; NO_SHOW added to UNIT-05 and API-23 (already tested); E2E-06 dependency on E2E-05 written down; §6 red step for E2E-07/08; "Result" column filled from the release run. |
| 1.3 | 2026-11-11 | Yanis Amrane | Lab 5 (Issue #20, NFR-12): UNIT-07, API-26, API-27, DB-03, DB-04 added for AC-33..AC-37 (F-00 1.2); DB-02 precondition names `NODE_ENV=test`. |
| 1.4 | 2026-11-12 | Yanis Amrane | Lab 5 (Issue #21, NFR-12): UNIT-08 added for AC-38 (graceful shutdown on SIGTERM, F-00 1.3). |
