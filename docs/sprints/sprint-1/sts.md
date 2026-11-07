# Sprint 1 — Software Test Specification (STS)

Version 1.0 (2026-11-07). Each test name in code **starts with its Test ID** (e.g.
`it('API-15: books a bookable slot …')`). Test databases are reset and seeded before each run; time-based
rules use `freezeClock()` (server) or slots created relative to the real clock (E2E). The "Result" column
is filled from the real release run (Part F); `—` until then.

Levels: **Unit** = pure function, no DB · **API** = Supertest against the Express app + test PostgreSQL ·
**DB** = direct Prisma/SQL on the test database · **UI** = component test (Vitest + Testing Library,
mocked fetch) · **E2E** = Playwright against the running app.

## 1. Unit Tests — `server/tests/unit/`

| Test ID | AC | Level | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UNIT-01 | AC-12 | Unit | Clock 2026-11-10 08:00 Bangkok; inputs: past start, 09:10, 07:45, 17:45 + 30 min, inactive service, valid 09:30 | `validateSlot(input, service, now)` | Errors on `startTime`/`serviceId` for each invalid input with the specified messages; valid input → `{ startAt, endAt }` with end = start + duration; 17:30 + 30 min (ends 18:00) valid | `slotRules.test.ts` | — |
| UNIT-02 | AC-13 | Unit | Existing own slots 09:00–09:30 (OPEN), 10:00–10:30 (CANCELLED) | `overlaps(a, b)` / `findOverlap(new, existing)` | 09:15–09:45 overlaps; 09:30–10:00 does not (touching); 10:00–10:30 ignored because CANCELLED | `slotRules.test.ts` | — |
| UNIT-03 | AC-17 | Unit | year 2026, seq 15 / seq 1234567 | `formatReference(year, seq)` | `BK-2026-000015`; seq > 999999 throws | `bookingRules.test.ts` | — |
| UNIT-04 | AC-20, AC-21 | Unit | Clock fixed; slots at +60 min, +59 min, CLOSED; customer with 2 / 3 active future bookings; overlapping and back-to-back bookings | `isBookable`, `checkCustomerLimits` | +60 bookable, +59 and CLOSED → `SLOT_NOT_BOOKABLE`; 3 active → `BOOKING_LIMIT_REACHED`; past/cancelled not counted; overlap → `BOOKING_OVERLAP`; back-to-back → null | `bookingRules.test.ts` | — |
| UNIT-05 | AC-26 | Unit | Bookings BOOKED at +120 min, +119 min; CANCELLED; COMPLETED | `canCustomerCancel` | +120 → null; +119 → `CANCELLATION_WINDOW_CLOSED`; CANCELLED/COMPLETED → `BOOKING_NOT_ACTIVE` (checked first) | `bookingRules.test.ts` | — |

## 2. API / Database Integration Tests — `server/tests/api/`, `server/tests/db/`

| Test ID | AC | Level | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| API-01 | AC-01 | API | Seeded active Customer | `POST /api/auth/login` valid credentials (upper-case e-mail variant too) | 200 `{ user: { id, name, email, role } }`, no `passwordHash`/`isActive`; `Set-Cookie` has `HttpOnly` and `SameSite=Lax` | `auth.api.test.ts` | — |
| API-02 | AC-02 | API | Seeded users | Login with wrong password; unknown e-mail | Both 401 `INVALID_CREDENTIALS`, identical message; following `/me` with that agent → 401 | `auth.api.test.ts` | — |
| API-03 | AC-02 | API | Seeded inactive Customer; active user deactivated after login | Login inactive; call `/me` after deactivation | Login 401 `INVALID_CREDENTIALS` (same message); existing session → 401 `UNAUTHENTICATED` | `auth.api.test.ts` | — |
| API-04 | AC-03 | API | Logged-in Staff; anonymous agent | `GET /api/auth/me` | 200 current user with role `STAFF`; anonymous 401 `UNAUTHENTICATED` | `auth.api.test.ts` | — |
| API-05 | AC-04 | API | Logged-in Customer, cookie saved | `POST /api/auth/logout`, then reuse the saved cookie on `/me` and `GET /api/services` | 204; both later calls 401 | `auth.api.test.ts` | — |
| API-06 | AC-06 | API | `PROTECTED_ROUTES` table (grows with each Issue) | Call every route without a cookie | 401 `UNAUTHENTICATED`, body keys exactly `error`, `message` | `access.api.test.ts` | — |
| API-07 | AC-07 | API | Logged-in Customer and Staff | Call every role-restricted route with the other role | 403 `FORBIDDEN`, body keys exactly `error`, `message` | `access.api.test.ts` | — |
| API-08 | AC-08 | API | Staff Anan logged in; Customer Ploy logged in | `POST /api/staff/slots` with `staffId` of Mali; `POST /api/bookings` with `customerId` of Ken (added in Issue #5) | Slot stored with Anan's id; booking stored for Ploy | `access.api.test.ts` | — |
| API-09 | AC-09 | API | Test-only route that throws (mounted when `NODE_ENV=test`) and a Prisma error | Call it | 500 `{ error: "INTERNAL_ERROR", message }`, no `stack`, SQL keyword or file path in the body | `access.api.test.ts` | — |
| API-10 | AC-11 | API | Staff Anan, clock fixed | `POST /api/staff/slots` valid; then `GET /api/staff/slots` | 201, DB row with `staffId` Anan, OPEN, `endAt` = start + duration; slot listed | `slots.api.test.ts` | — |
| API-11 | AC-12 | API | Staff Anan | Post past, 09:10, 07:45, 17:45 (30 min), inactive service, missing fields | Each 422 `VALIDATION_ERROR` with the expected `fields` key; slot count unchanged | `slots.api.test.ts` | — |
| API-12 | AC-13 | API | Anan has 09:00–09:30 | Post 09:15 (Anan); 09:15 (Mali); 09:30 (Anan); two overlapping posts in parallel | 409 `SLOT_OVERLAP`; 201; 201; parallel → one 201 + one 409 | `slots.api.test.ts` | — |
| API-13 | AC-14 | API | Anan and Mali have slots, one of Anan's booked, one past, one cancelled | `GET /api/staff/slots` as Anan | Only Anan's upcoming non-cancelled slots, ordered; booked one has `booking.reference` + customer name | `slots.api.test.ts` | — |
| API-14 | AC-16 | API | Clock fixed; day with OPEN (free), booked, CLOSED, +30 min, inactive-service slots | `GET /api/slots/available?date=` with/without `serviceId`; as Staff | Only bookable slots, ordered, filtered by service, no customer data; Staff → 403; bad date → 422 | `bookings.api.test.ts` | — |
| API-15 | AC-17 | API | Ploy, bookable slot | `POST /api/bookings { slotId, note }`; then available list | 201 BOOKED, reference `^BK-\d{4}-\d{6}$`, owner Ploy in DB; slot absent from available | `bookings.api.test.ts` | — |
| API-16 | AC-18 | API | Slot booked by Ken | Ploy books it | 409 `SLOT_ALREADY_BOOKED`; DB has exactly 1 BOOKED booking for the slot | `bookings.api.test.ts` | — |
| API-17 | AC-19 | API | Free slot; Ploy and Nina logged in | Both `POST /api/bookings` in `Promise.all` | Status codes sorted = [201, 409]; 1 BOOKED row | `bookings.api.test.ts` | — |
| API-18 | AC-20 | API | Slot starting in 30 min; CLOSED slot; slotId 999999 | Ploy books each | 409 `SLOT_NOT_BOOKABLE`, 409 `SLOT_NOT_BOOKABLE`, 404 `NOT_FOUND`; no booking stored | `bookings.api.test.ts` | — |
| API-19 | AC-21 | API | Nina with 3 active future bookings; Ploy with a booking 10:00–10:30 | Nina books a 4th; Ploy books another staff's 10:15 slot | 409 `BOOKING_LIMIT_REACHED`; 409 `BOOKING_OVERLAP`; nothing stored | `bookings.api.test.ts` | — |
| API-20 | AC-23 | API | Ploy and Ken with bookings | `GET /api/bookings/mine` and `GET /api/bookings/:ref` as Ploy; log out, log in again, repeat | Only Ploy's bookings, correct split/order; same data after re-login | `my-bookings.api.test.ts` | — |
| API-21 | AC-24 | API | Ken's booking reference | Ploy `GET` and `POST …/cancel` on it | Both 404 `NOT_FOUND`, no booking fields in body; Ken's booking still BOOKED | `my-bookings.api.test.ts` | — |
| API-22 | AC-25 | API | Ploy's booking at +3 h | Cancel; then Nina lists available and books the slot | 200 CANCELLED + `cancelledAt`; slot listed again; Nina 201 | `my-bookings.api.test.ts` | — |
| API-23 | AC-26 | API | Ploy's booking at +90 min; a CANCELLED and a COMPLETED booking | Cancel each | 409 `CANCELLATION_WINDOW_CLOSED`, 409 `BOOKING_NOT_ACTIVE` ×2; rows unchanged | `my-bookings.api.test.ts` | — |
| API-24 | AC-28 | API | Anan and Mali slots on a date, some booked | `GET /api/staff/schedule?date=` as Anan; as Ploy; bad date | Only Anan's slots with reference, customer, note and correct summary; Ploy 403; 422 | `schedule.api.test.ts` | — |
| API-25 | AC-31 | API | DB up | `GET /api/health` without session | 200 `{ status: "ok", database: "up" }` | `health.api.test.ts` | — |
| DB-01 | AC-19 | DB | Free slot | Insert two `BOOKED` bookings for the slot directly with Prisma | Second insert fails with unique violation `P2002` on `booking_one_active_per_slot`; a second `CANCELLED` row is allowed | `server/tests/db/constraints.db.test.ts` | — |
| DB-02 | AC-32 | DB | Fresh test DB | Run the seed twice | Same counts after both runs; seeded e-mails present with roles; every `passwordHash` starts with `$2` and no column equals `SEED_PASSWORD` | `server/tests/db/seed.db.test.ts` | — |

## 3. UI Component Tests — `client/tests/`

| Test ID | AC | Level | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UI-01 | AC-05 | UI | Mocked `/api/auth/login` 200 / 401 | Fill and submit the login form | Labels present; button disabled while pending; 401 → alert with message, e-mail kept, password cleared; 200 → navigate to role home | `LoginPage.test.tsx` | — |
| UI-02 | AC-15 | UI | Mocked services, slots, 422 and 201 responses | Render My Slots, submit invalid then valid | Loading skeleton (`aria-busy`), field error under Start time, success toast and refreshed list; empty state text | `MySlotsPage.test.tsx` | — |
| UI-03 | AC-22 | UI | Mocked available slots, 201 and 409 | Open dialog, confirm | Dialog focus trap + Esc; 201 → reference shown; 409 → message in dialog and list re-fetched; empty state text | `BookSlotPage.test.tsx` | — |
| UI-04 | AC-27 | UI | Mocked `mine` with upcoming/past, cancel 200 | Render, cancel | Two sections; Cancel only for cancellable booking; after confirm the badge shows Cancelled | `MyBookingsPage.test.tsx` | — |

## 4. End-to-End Tests — `e2e/`

| Test ID | AC | Level | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E2E-01 | AC-05, AC-04 | E2E | Seeded accounts | Customer logs in → `/book`, header name; logs out; Staff logs in → `/staff/slots`; wrong password | Correct landing pages and header; logout → `/login`, back button does not show data; error message on wrong password | `auth.spec.ts` | — |
| E2E-02 | AC-10 | E2E | Seeded accounts | Anonymous opens `/bookings`; Customer opens `/staff/slots`; Staff opens `/book` | Redirects to `/login`, `/book`, `/staff/slots` respectively | `auth.spec.ts` | — |
| E2E-03 | AC-15 | E2E | Staff Mali | Publish a slot tomorrow 14:00; try an overlapping one | New slot listed; overlap message shown | `staff-slots.spec.ts` | — |
| E2E-04 | AC-22, AC-17 | E2E | Free Mali slot tomorrow created by `e2e/global-setup.ts` (independent of E2E-03) | Ploy filters tomorrow, books it with a note | Reference shown; slot gone from the list | `booking-journey.spec.ts` | — |
| E2E-05 | AC-27, AC-23, AC-25 | E2E | Booking from E2E-04 | Ploy opens My Bookings, reloads, logs out/in, opens detail, cancels | Booking persisted across reload and re-login; after cancel badge Cancelled and slot bookable again on `/book` | `booking-journey.spec.ts` | — |
| E2E-06 | AC-29 | E2E | Ploy books a Mali slot | Mali opens Schedule for that day; Anan opens the same day | Mali sees reference + "Ploy Chai"; Anan does not | `schedule.spec.ts` | — |
| E2E-07 | AC-30 | E2E | Each S1 page per role | Load at 320×800, 768×1024, 1280×900 | `document.documentElement.scrollWidth <= clientWidth`; main buttons visible | `responsive-a11y.spec.ts` | — |
| E2E-08 | AC-30 | E2E | Customer account | Log in and book using only Tab/Shift+Tab/Enter/Esc | Booking succeeds; focused elements have a visible outline | `responsive-a11y.spec.ts` | — |

## 5. AC → Test Coverage (all Sprint 1 AC)

| AC | Tests | AC | Tests |
| :--- | :--- | :--- | :--- |
| AC-01 | API-01 | AC-17 | UNIT-03, API-15, E2E-04 |
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

**Manual checks** (supplement only, recorded in Part F, never replacing a test above): MAN-01 visual
review of the five screens against `system-sds.md` §3; MAN-02 clean-clone setup following the README.

## 6. TDD Evidence Rule

For the rule work of Issues #4–#6 (UNIT-01/02/04/05, API-12, API-16..19, API-21..23) the tests are
committed first (`test(<F-xx>): … [red]`), run, and their failing output saved to
`artifacts/sprint-1/tdd/<test-id>-red.txt`; the implementation commit follows and the passing output is
saved to `…-green.txt`. Both commit hashes are written at the top of each file.

## 7. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-07 | Yanis Amrane | Initial STS for Sprint 1 (reviewed by Simeon in the contract PR). |
