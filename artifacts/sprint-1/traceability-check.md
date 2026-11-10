# Sprint 1 traceability check

Branch `release/sprint-1`, commit `2c7bb4e`, date 2026-11-10T08:22:10.513Z, command `node scripts/traceability-check.mjs`.

A test counts as found when an `it(`/`test(` call at the start of a line (comments ignored) in the file listed by `sts.md` has a name starting with `<ID>:`, and that file contains no `.skip`, `.only`, `.todo`, `.fixme`, `.skipIf`, `.runIf`, `xit`, `xdescribe`, `xtest` or runtime `.skip()`. An AC is covered when it is in the §5 table, every test listed for it there is found and names the AC on its own row, and every row naming the AC is listed for it in §5. Whether the tests pass is recorded in `clean-clone-check.md` and in the "Result" column of `sts.md`.

## Test IDs (45/45 found)

| Test ID | AC | File | Test name(s) | Found |
| :--- | :--- | :--- | :--- | :--- |
| UNIT-01 | AC-12 | `server/tests/unit/slotRules.test.ts` | UNIT-01: rejects past, off-step, out-of-hours and inactive-service slots with the specified messages; accepts valid ones | yes |
| UNIT-02 | AC-13 | `server/tests/unit/slotRules.test.ts` | UNIT-02: overlapping ranges collide, touching edges do not, cancelled slots are ignored | yes |
| UNIT-03 | AC-17 | `server/tests/unit/bookingRules.test.ts` | UNIT-03: formats BK-YYYY-NNNNNN and throws when the sequence exceeds 999999 | yes |
| UNIT-04 | AC-20, AC-21 | `server/tests/unit/bookingRules.test.ts` | UNIT-04: +60 min is bookable; +59 min, CLOSED/CANCELLED and inactive service are not; 3 active → limit; past/cancelled not counted; overlap vs back-to-back | yes |
| UNIT-05 | AC-26 | `server/tests/unit/bookingRules.test.ts` | UNIT-05: +120 min → allowed; +119 min → CANCELLATION_WINDOW_CLOSED; CANCELLED/COMPLETED/NO_SHOW → BOOKING_NOT_ACTIVE, checked first | yes |
| UNIT-06 | AC-01 | `server/tests/unit/sessionConfig.test.ts` | UNIT-06: production cookie is Secure, HttpOnly, SameSite=Lax, 8 h rolling; development is not Secure | yes |
| API-01 | AC-01 | `server/tests/api/auth.api.test.ts` | API-01: valid credentials (also upper-case e-mail) return the user without secrets and an HttpOnly SameSite=Lax cookie | yes |
| API-02 | AC-02 | `server/tests/api/auth.api.test.ts` | API-02: wrong password and unknown e-mail both return 401 INVALID_CREDENTIALS with the same message; no session follows / API-02: malformed login input → 422 VALIDATION_ERROR with fields (F-01 §2/§7 boundaries) | yes |
| API-03 | AC-02 | `server/tests/api/auth.api.test.ts` | API-03: an inactive account cannot log in; a session of a user deactivated later gets 401 UNAUTHENTICATED | yes |
| API-04 | AC-03 | `server/tests/api/auth.api.test.ts` | API-04: /me returns the current Staff user; anonymous gets 401 UNAUTHENTICATED | yes |
| API-05 | AC-04 | `server/tests/api/auth.api.test.ts` | API-05: after logout (204) the saved cookie is rejected on /me and on a protected endpoint | yes |
| API-06 | AC-06 | `server/tests/api/access.api.test.ts` | API-06: ${route.method.toUpperCase()} ${route.path} without a session → 401 UNAUTHENTICATED { error, message } | yes |
| API-07 | AC-07 | `server/tests/api/access.api.test.ts` | API-07: requireRole answers another role with 403 FORBIDDEN and only { error, message } / API-07: ${route.method.toUpperCase()} ${route.path} as ${other} → 403 FORBIDDEN | yes |
| API-08 | AC-08 | `server/tests/api/access.api.test.ts` | API-08: staffId in the body is ignored; the slot belongs to the session staff member / API-08: customerId in the body is ignored; the booking belongs to the session customer | yes |
| API-09 | AC-09 | `server/tests/api/access.api.test.ts` | API-09: ${path} → 500 INTERNAL_ERROR without stack trace, SQL or file path | yes |
| API-10 | AC-11 | `server/tests/api/slots.api.test.ts` | API-10: a valid slot is created for the session staff member, OPEN, end = start + duration, and listed | yes |
| API-11 | AC-12 | `server/tests/api/slots.api.test.ts` | API-11: past, off-step, out-of-hours, inactive-service and incomplete slots → 422 VALIDATION_ERROR with the field; nothing stored | yes |
| API-12 | AC-13 | `server/tests/api/slots.api.test.ts` | API-12: own overlap → 409 SLOT_OVERLAP; same time for another staff and touching slots are accepted; parallel overlap → one 201, one 409 | yes |
| API-13 | AC-14 | `server/tests/api/slots.api.test.ts` | API-13: lists only the caller\ | yes |
| API-14 | AC-16 | `server/tests/api/bookings.api.test.ts` | API-14: only OPEN slots of that Bangkok day starting ≥ 60 min from now, unbooked, active service, ordered, filtered; no customer data; Staff 403; bad query 422 | yes |
| API-15 | AC-17 | `server/tests/api/bookings.api.test.ts` | API-15: Ploy books a bookable slot → 201 BOOKED with a BK-YYYY-NNNNNN reference, owned by Ploy, gone from the available list / API-15: a note of exactly 300 characters is accepted; 301 characters or a bad slotId → 422 with the field, nothing stored | yes |
| API-16 | AC-18 | `server/tests/api/bookings.api.test.ts` | API-16: booking a slot Ken already booked → 409 SLOT_ALREADY_BOOKED; exactly one BOOKED booking remains | yes |
| API-17 | AC-19 | `server/tests/api/bookings.api.test.ts` | API-17: Ploy and Nina book the same free slot in parallel → one 201 and one 409; one BOOKED row (NFR-04) / API-17: a race lost on the partial unique index (Prisma P2002) is answered 409 SLOT_ALREADY_BOOKED | yes |
| API-18 | AC-20 | `server/tests/api/bookings.api.test.ts` | API-18: a slot starting in 30 min, a CLOSED slot and a slot of the inactive service → 409 SLOT_NOT_BOOKABLE; unknown slot → 404; nothing stored | yes |
| API-19 | AC-21 | `server/tests/api/bookings.api.test.ts` | API-19: Nina with 3 active future bookings → 409 BOOKING_LIMIT_REACHED; Ploy overlapping her own booking → 409 BOOKING_OVERLAP; nothing stored | yes |
| API-20 | AC-23 | `server/tests/api/my-bookings.api.test.ts` | API-20: only the caller\ | yes |
| API-21 | AC-24 | `server/tests/api/my-bookings.api.test.ts` | API-21: reading or cancelling Ken\ | yes |
| API-22 | AC-25 | `server/tests/api/my-bookings.api.test.ts` | API-22: cancelling at +3 h (and exactly +120 min) → 200 CANCELLED with cancelledAt; the slot is available again and Nina books it | yes |
| API-23 | AC-26 | `server/tests/api/my-bookings.api.test.ts` | API-23: inside 2 h → 409 CANCELLATION_WINDOW_CLOSED; CANCELLED/COMPLETED/NO_SHOW (or a second cancel) → 409 BOOKING_NOT_ACTIVE; rows unchanged | yes |
| API-24 | AC-28 | `server/tests/api/schedule.api.test.ts` | API-24: only the caller\ | yes |
| API-25 | AC-31 | `server/tests/api/health.api.test.ts` | API-25: returns 200 { status:  | yes |
| DB-01 | AC-19 | `server/tests/db/constraints.db.test.ts` | DB-01: a second BOOKED booking for one slot fails with P2002 on booking_one_active_per_slot; a second CANCELLED one is allowed | yes |
| DB-02 | AC-32 | `server/tests/db/seed.db.test.ts` | DB-02: running the seed twice gives the same counts, the seeded accounts with roles and no plaintext password | yes |
| UI-01 | AC-05 | `client/tests/LoginPage.test.tsx` | UI-01: labelled form, busy button, 401 keeps e-mail and clears password, 200 goes to the role home | yes |
| UI-02 | AC-15 | `client/tests/MySlotsPage.test.tsx` | UI-02: skeleton while loading, empty state, field error under Start time, then toast and refreshed list | yes |
| UI-03 | AC-22 | `client/tests/BookSlotPage.test.tsx` | UI-03: dialog with focus trap and Esc, busy confirm, reference on 201, 409 message in the dialog and list re-fetched; empty state / UI-03: a failed load shows the error callout with Retry | yes |
| UI-04 | AC-27 | `client/tests/MyBookingsPage.test.tsx` | UI-04: two sections with badges; Cancel only for the cancellable booking; after confirming, the badge shows Cancelled / UI-04: a refused cancel (409) closes the dialog, shows the server message on the page, focuses the heading and reloads the status / UI-04: empty list, load error with Retry, and  | yes |
| E2E-01 | AC-05, AC-04 | `e2e/auth.spec.ts` | E2E-01: each role lands on its home with name and role in the header; logout and wrong password | yes |
| E2E-02 | AC-10 | `e2e/auth.spec.ts` | E2E-02: protected pages redirect anonymous users to /login and other roles to their own home | yes |
| E2E-03 | AC-15 | `e2e/staff-slots.spec.ts` | E2E-03: Mali publishes a slot on My Slots and sees it listed; an overlapping slot shows the overlap message | yes |
| E2E-04 | AC-22, AC-17 | `e2e/booking-journey.spec.ts` | E2E-04: Ploy filters the date and service, books the Mali slot with a note, sees the reference and the slot leaves the list | yes |
| E2E-05 | AC-27, AC-23, AC-25 | `e2e/booking-journey.spec.ts` | E2E-05: the booking survives a reload and a new login; Ploy opens the detail, cancels it, sees Cancelled and the slot is bookable again | yes |
| E2E-06 | AC-29 | `e2e/schedule.spec.ts` | E2E-06: after Ploy books the Mali slot, Mali sees the reference and  | yes |
| E2E-07 | AC-30 | `e2e/responsive-a11y.spec.ts` | E2E-07: /login, /book, /bookings, /staff/slots and /staff/schedule have no horizontal scroll or clipped control at 320, 768 and 1280 px | yes |
| E2E-08 | AC-30 | `e2e/responsive-a11y.spec.ts` | E2E-08: Ken logs in and books a slot with Tab/Shift+Tab/Enter/Esc only, with a visible focus ring | yes |

## Acceptance criteria (32/32 covered)

| AC | Tests (sts.md §5) | Covered |
| :--- | :--- | :--- |
| AC-01 | API-01, UNIT-06 | yes |
| AC-02 | API-02, API-03 | yes |
| AC-03 | API-04 | yes |
| AC-04 | API-05, E2E-01 | yes |
| AC-05 | UI-01, E2E-01 | yes |
| AC-06 | API-06 | yes |
| AC-07 | API-07 | yes |
| AC-08 | API-08 | yes |
| AC-09 | API-09 | yes |
| AC-10 | E2E-02 | yes |
| AC-11 | API-10 | yes |
| AC-12 | UNIT-01, API-11 | yes |
| AC-13 | UNIT-02, API-12 | yes |
| AC-14 | API-13 | yes |
| AC-15 | UI-02, E2E-03 | yes |
| AC-16 | API-14 | yes |
| AC-17 | UNIT-03, API-15, E2E-04 | yes |
| AC-18 | API-16 | yes |
| AC-19 | API-17, DB-01 | yes |
| AC-20 | UNIT-04, API-18 | yes |
| AC-21 | UNIT-04, API-19 | yes |
| AC-22 | UI-03, E2E-04 | yes |
| AC-23 | API-20, E2E-05 | yes |
| AC-24 | API-21 | yes |
| AC-25 | API-22, E2E-05 | yes |
| AC-26 | UNIT-05, API-23 | yes |
| AC-27 | UI-04, E2E-05 | yes |
| AC-28 | API-24 | yes |
| AC-29 | E2E-06 | yes |
| AC-30 | E2E-07, E2E-08 | yes |
| AC-31 | API-25 | yes |
| AC-32 | DB-02 | yes |

## Skipped or focused tests

None: no test file under `server/tests`, `client/tests` or `e2e` contains a skip/only/todo/fixme/skipIf/runIf modifier, `xit`/`xdescribe`/`xtest` or a runtime `.skip()`.

**Result:** no gap.
