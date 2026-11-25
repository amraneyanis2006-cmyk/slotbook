# Sprint 2 — Software Test Specification (STS)

Version 1.1 (2026-11-25), written with the Sprint 2 contracts **before** any Sprint 2 code (Issue #49).
Same conventions as `../sprint-1/sts.md`: each test name in code **starts with its Test ID**; test databases
are reset and seeded before each run; time rules use `freezeClock()` (server) or data relative to the real
clock (E2E). The "Result" column is filled from the Sprint 2 release run (Issue #56).

**1.1 (Issue #50):** §4 path corrected to `client/tests/` (where the Sprint 1 component tests live); file names in
the tables are relative to the directory of their section.

**Regression.** Every Sprint 1 test (UNIT-01..08, API-01..28, DB-01..04, UI-01..05, E2E-01..08) stays in the
suites and must still pass; a Sprint 1 test changed by a Sprint 2 contract is listed in §7 with its reason.

## 1. Unit Tests — `server/tests/unit/`

| Test ID | AC | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UNIT-09 | AC-40, AC-41 | Pairs `null→BOOKED`, `BOOKED→CANCELLED/COMPLETED/NO_SHOW`, `CANCELLED→BOOKED`, `BOOKED→BOOKED`; rows with equal `createdAt` | `isValidTransition`, `toHistoryView` | Only the 5 pairs of F-10 §1 are valid; rows ordered by `createdAt` then `id`; entries carry name and role, no e-mail or id | `historyRules.test.ts` | Pending |
| UNIT-10 | AC-45 | Names of 2/3/60/61 chars, "  Visa   letter  "; durations 0, 10, 15, 120, 135, 22.5; PATCH `{}` | `validateService` | Field messages of F-11 §2; name normalised to "Visa letter"; `{}` with `partial` → `fields._` | `serviceRules.test.ts` | Pending |
| UNIT-11 | AC-49..AC-53 | Clock fixed; slots OPEN/CLOSED/CANCELLED, start +1 min / now / −1 min, with and without booking | `checkSlotChange(action, …)` for edit, close, reopen, cancel | `SLOT_NOT_EDITABLE` first (cancelled, started, wrong status for close/reopen), then `SLOT_HAS_BOOKING` for edit/close only; cancel of a booked future slot → null | `slotRules.test.ts` | Pending |
| UNIT-12 | AC-55, AC-56 | Bookings BOOKED at start −1 min, exactly start, +3 h after; CANCELLED/COMPLETED/NO_SHOW after start | `canRecordOutcome` | −1 min → `OUTCOME_TOO_EARLY`; start and later → null; non-BOOKED → `BOOKING_NOT_ACTIVE` (checked first) | `bookingRules.test.ts` | Pending |
| UNIT-13 | AC-62 | Old slot (service 1); new slot = old, service 2, service 1 | `checkRescheduleTarget` | Same slot → `{ slotId: 'Choose a different slot.' }`; other service → same-service message; valid → null | `bookingRules.test.ts` | Pending |
| UNIT-14 | AC-65 | today fixed; from/to valid, swapped, 14 and 15 days, bad formats, ids 0/−1/"x" | `validateSearch` | Messages of F-12 §2; 14 days (from + 13) accepted, 15 rejected; past `from` accepted | `searchRules.test.ts` | Pending |

## 2. API / Database Integration Tests — `server/tests/api/`, `server/tests/db/`

| Test ID | AC | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| API-29 | AC-40 | Customer, bookable slot; then a non-bookable slot | `POST /api/bookings`, `POST …/cancel`; then a booking refused with 409 | One row `null→BOOKED` (actor customer) after booking, one `BOOKED→CANCELLED` after cancel, same `createdAt` as the change; the 409 leaves no row | `history.api.test.ts` | Pending |
| API-30 | AC-41 | Booking of customer A on a slot of staff Anan | `GET /api/bookings/:ref` as A, B, Staff; `GET /api/staff/bookings/:ref` as Anan, Mali, A | A: 200 with `history` oldest first; B: 404 no data; Staff on customer route: 403; Anan: 200 with customer name; Mali: 404; A on staff route: 403 | `history.api.test.ts` | Pending |
| DB-05 | AC-42 | One history row | Prisma `update` and `delete` on `BookingStatusChange`; raw `UPDATE` | All refused by the trigger ("append-only"); row unchanged; deleting the booking itself (test helper) cascades | `history.db.test.ts` | Pending |
| DB-06 | AC-42 | Seeded bookings in every status; history table truncated | Run the backfill block of the history migration (between `-- backfill:start` / `-- backfill:end`) | Every booking has a history whose last `toStatus` is its current status; second rows carry the marker reason; re-running the seed keeps the counts | `history.db.test.ts` | Pending |
| API-31 | AC-44 | Staff | `GET`, `POST`, `PATCH /api/staff/services…` (create, rename, duration 45 → 60) | Lists inactive services and `upcomingSlots`; 201/200 bodies; new service in `GET /api/services`; slot published with it; an older slot keeps its times after the duration change | `services.api.test.ts` | Pending |
| API-32 | AC-45 | Staff and Customer | Invalid bodies, "academic ADVISING", unknown id, Customer call | 422 with field messages; 409 `SERVICE_NAME_TAKEN`; 404; 403; database unchanged | `services.api.test.ts` | Pending |
| DB-07 | AC-45 | Service "Academic advising" | Raw insert "ACADEMIC ADVISING" | Refused by the unique index `service_name_ci` | `services.db.test.ts` | Pending |
| API-33 | AC-46 | Active service with an OPEN slot and a BOOKED booking | PATCH `isActive: false`, then book the open slot, then reactivate | Service absent from `GET /api/services`, slot absent from available, booking → 409 `SLOT_NOT_BOOKABLE`; existing booking unchanged; reactivation restores both | `services.api.test.ts` | Pending |
| API-34 | AC-47 | Clock fixed; 120-min service; customer's booking started 30 min ago (Anan); Mali's slots at +60 min (overlapping) and at the booking's end | `POST /api/bookings` twice | Overlapping → 409 `BOOKING_OVERLAP`; slot at the booking's end → 201 | `bookings.api.test.ts` | Pending |
| API-35 | AC-49 | Anan's unbooked future slots; another own slot later | `PATCH /api/staff/slots/:id` valid, past, 07:45, overlapping, +15 min within own range | 200 new times same duration; 422 field messages; 409 `SLOT_OVERLAP`; +15 min → 200 | `slotMaintenance.api.test.ts` | Pending |
| API-36 | AC-50 | Anan's OPEN unbooked future slot | `POST …/close`, customer `GET /available` and `POST /api/bookings`, `POST …/reopen` | CLOSED, not listed, 409 `SLOT_NOT_BOOKABLE`; after reopen listed and bookable | `slotMaintenance.api.test.ts` | Pending |
| API-37 | AC-51 | Anan's slot with a BOOKED booking | `PATCH` and `POST …/close` | 409 `SLOT_HAS_BOOKING`; slot and booking unchanged | `slotMaintenance.api.test.ts` | Pending |
| API-38 | AC-52 | Anan's booked slot | `POST …/cancel` with "Staff illness"; another without reason | Slot CANCELLED; booking CANCELLED, `cancelledById` = Anan; history row with reason; customer sees it in `history`; `cancelledBooking` = reference; missing reason → 422, nothing changes | `slotMaintenance.api.test.ts` | Pending |
| API-39 | AC-53 | Started slot, CANCELLED slot, Mali's slot, Customer | each action | 409 `SLOT_NOT_EDITABLE`; Mali's slot → 404 unchanged; Customer → 403; id "abc" → 404 | `slotMaintenance.api.test.ts` | Pending |
| API-40 | AC-55 | Clock frozen after the start of Anan's two booked slots (one exactly at start) | `POST /api/staff/bookings/:ref/outcome` COMPLETED, NO_SHOW | 200 with new status; history row actor Anan | `attendance.api.test.ts` | Pending |
| API-41 | AC-56 | Booked slot starting in 1 min; CANCELLED/COMPLETED booking; Mali; Customer; outcome "BOOKED" | outcome call | 409 `OUTCOME_TOO_EARLY`; 409 `BOOKING_NOT_ACTIVE`; 404; 403; 422; booking and history unchanged | `attendance.api.test.ts` | Pending |
| API-42 | AC-57 | Day with a started BOOKED booking and a future one | `GET /api/staff/schedule`; after recording, customer `GET /api/bookings/mine` | `canRecordOutcome` true only for the started one; recorded booking under `past` with its status | `attendance.api.test.ts` | Pending |
| API-43 | AC-59 | Customer booking ≥ 24 h ahead with a note; free slot of the same service | `POST /api/bookings/:ref/reschedule` | 201 new reference BOOKED with the note; old CANCELLED; history reasons "Rescheduled to/from"; old slot listed again | `reschedule.api.test.ts` | Pending |
| API-44 | AC-60 | Targets: CLOSED, +59 min, inactive service, already booked; customer at the limit by another path; overlapping own booking | reschedule each | F-04 error code each time; old booking still BOOKED, history count unchanged, booking count unchanged | `reschedule.api.test.ts` | Pending |
| API-45 | AC-61 | Customer with 3 active bookings; target 15 min after the old slot (other staff) | reschedule | 201 in both cases (old booking excluded from BR-03/BR-04) | `reschedule.api.test.ts` | Pending |
| API-46 | AC-62 | Booking 23 h 59 min ahead; exactly 24 h; CANCELLED booking; other customer; same slot; other service; Staff | reschedule | 409 `CANCELLATION_WINDOW_CLOSED`; 24 h → 201; 409 `BOOKING_NOT_ACTIVE`; 404; 422 ×2; 403 | `reschedule.api.test.ts` | Pending |
| API-47 | AC-64 | Slots over 3 days, two staff, two services; one staff deactivated; one service inactive; one booked | `GET /api/slots/search` with filters | Only bookable slots in range, filtered, ordered, no customer data; deactivated staff / inactive service / booked excluded | `search.api.test.ts` | Pending |
| API-48 | AC-65 | Bad queries; Staff; 201 matching slots | search | 422 messages; 403; 200 items + `truncated: true` | `search.api.test.ts` | Pending |
| API-49 | AC-64 | Seed (2 active staff) + one deactivated staff | `GET /api/staff-members` as Customer | Active staff only, by name, `{ id, name }` only | `search.api.test.ts` | Pending |

## 3. Performance — `server/tests/perf/`

| Test ID | AC | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PERF-01 | AC-66 | `_test` database with the seed ×10 (`seedTimes10`); run with `npm run test:perf` (not part of `npm test`) | 100 sequential calls each: search (14 days), available (one day), book (distinct slots) | p95 < 500 ms for each; min/median/p95/max written to `artifacts/sprint-2/perf/perf-<commit>.txt` | `perf.test.ts` | Pending |

## 4. Client Component Tests — `client/tests/`

| Test ID | AC | Precondition / input | Action | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UI-06 | AC-43 | Mocked detail with 2 history entries, one with a staff reason | Render `BookingDetailPage` | Ordered list with the 2 lines; callout "Cancelled by Anan Wong: Staff illness" | `BookingDetailPage.test.tsx` | Pending |
| UI-07 | AC-48 | Mocked services; 422 then 409 on create | Render `ServicesPage`, submit, deactivate | Field errors under fields, 409 under Name; Inactive badge after confirming the dialog | `ServicesPage.test.tsx` | Pending |
| UI-08 | AC-54 | Mocked slots: open, closed, booked | Render `MySlotsPage`, open Actions | Booked → only **Cancel slot**; cancel dialog requires a reason (counter, error under field) and names the booking | `MySlotsPage.test.tsx` | Pending |
| UI-09 | AC-58 | Mocked schedule with `canRecordOutcome` true/false | Render `SchedulePage`, click No-show, confirm | Buttons only where true; after success the badge replaces the buttons | `SchedulePage.test.tsx` | Pending |
| UI-10 | AC-63 | Mocked booking and day slots; 409 on submit | Render `ReschedulePage` | Current slot excluded; **Move booking** disabled until a choice; 409 in a callout and list refreshed | `ReschedulePage.test.tsx` | Pending |
| UI-11 | AC-67 | Mocked search results over 2 days; 422 | Render `SearchPage` with URL params | Form filled from the URL; results grouped by day; field errors shown | `SearchPage.test.tsx` | Pending |

## 5. End-to-End Tests — `e2e/`

| Test ID | AC | Scenario | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| E2E-09 | AC-43 | Customer books, opens the detail, cancels | History shows "Booked" then "Cancelled", both by the customer | `sprint2-history.spec.ts` | Pending |
| E2E-10 | AC-48 | Staff adds "Visa letter (30 min)", sees it in the slot form, deactivates it | Inactive badge; not in the slot form | `sprint2-services.spec.ts` | Pending |
| E2E-11 | AC-54 | Customer books Mali's E2E slot; Mali cancels it with "Staff illness"; customer opens the booking | Cancelled badge and "Cancelled by Mali …: Staff illness"; close/reopen with the keyboard | `sprint2-slot-maintenance.spec.ts` | Pending |
| E2E-12 | AC-58 | Global setup adds a started BOOKED booking on Anan's schedule today; Anan records No-show | No-show badge on Schedule and in the customer's Past list | `sprint2-attendance.spec.ts` | Pending |
| E2E-13 | AC-63 | Customer reschedules a booking to another slot of the same service | New detail page; old booking Cancelled with "Rescheduled to BK-…" | `sprint2-reschedule.spec.ts` | Pending |
| E2E-14 | AC-67 | Customer searches 7 days, one service, one staff; books; reloads the URL | Grouped results; booked slot gone after reload | `sprint2-search.spec.ts` | Pending |
| E2E-15 | AC-68 | `/staff/services`, `/staff/slots` (actions), `/staff/bookings/:ref`, `/bookings/:ref/reschedule`, `/search` at 320, 768, 1280 px | No horizontal page scroll, no clipped control; dialogs keyboard-operable with visible focus | `sprint2-responsive.spec.ts` | Pending |

## 6. TDD Red Step per Issue

Each implementation Issue starts with a commit whose new tests fail for the right reason (missing route →
404, missing rule → wrong code, missing table → Prisma error), saved as
`artifacts/sprint-2/tdd/issue-<n>-red.txt`, then the green commit with `issue-<n>-green.txt` (branch, commit,
date, command, counts). Rule tests (UNIT-09..14) are written first in each Issue.

| Issue | Feature | Red tests (minimum) |
| :--- | :--- | :--- |
| #50 | F-10 | UNIT-09, API-29, API-30, DB-05, DB-06 |
| #51 | F-11 | UNIT-10, API-31..34, DB-07 |
| #52 | F-07 | UNIT-11, API-35..39 |
| #53 | F-09 | UNIT-12, API-40..42 |
| #54 | F-08 | UNIT-13, API-43..46 |
| #55 | F-12 | UNIT-14, API-47..49, PERF-01 |

## 7. Sprint 1 Tests Changed by Sprint 2

| Test | Change | Reason |
| :--- | :--- | :--- |
| UNIT-04, API-19 | BR-04 compares against bookings whose end is after now (was: start after now); expected results unchanged for Sprint 1 data | SRS A-04 resolved by F-11 (services up to 120 min); new case in API-34 |
| API-20, API-21 | Detail body also contains `history`; existing assertions unchanged | F-10 §3 |
| API-24 | Schedule booking also contains `canRecordOutcome` | F-09 §3 |
