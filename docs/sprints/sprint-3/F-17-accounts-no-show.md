# F-17 — Account Overview and No-Show Policy (Sprint 3 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-22, BR-19, BR-12, BR-17, Q-03, BR-08, BR-09 |
| Issue / owner / reviewer | Issue #61 — Simeon Audouit (author), Yanis Amrane (reviewer) |
| Depends on | F-09 (NO_SHOW outcomes), F-10 (history) |
| Contract version | 1.1 (2026-11-26) — history in §8 |

## 1. Behavior and Workflow

1. **Accounts** (`/staff/users`, Staff): the list of customer accounts (name, e-mail, status Active / Inactive /
   Suspended until …, active future bookings, no-shows in the last 30 days), searchable by name.
2. **Deactivate** a customer (confirmation dialog): in one transaction the account becomes inactive, and each
   of its BOOKED bookings that has not started is cancelled by the staff member with the reason
   **"account deactivated"** and a history row (Q-03, BR-17). The customer's sessions stop working at once
   (BR-12, already enforced by `requireAuth`). **Reactivate** sets the account active again (bookings stay cancelled).
3. **No-show policy (BR-19).** When a customer books (F-04) or reschedules (F-08), the server counts the NO_SHOW
   outcomes recorded for that customer during the last 30 days (history rows `→ NO_SHOW`, by their `createdAt`).
   From the third one, the customer is **suspended for 7 days after the time the third was recorded**: new
   bookings are refused with 409 `BOOKING_SUSPENDED` "Your booking access is suspended until <date> after 3
   missed appointments." Existing bookings are not touched.
4. Staff cannot deactivate a Staff account or themselves (403 is not used: these ids are simply not listed and
   answer 404).

## 2. Pure Rule Function

`suspendedUntil(noShowTimes, now)` in `server/src/rules/bookingRules.ts` → `Date | null`: take the NO_SHOW
times within `(now − 30 days, now]`, sorted; for each window of 3 consecutive ones the suspension ends 7 days after
the third; return the latest end that is after `now`, else `null`.

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/staff/users` | query `q` (optional) | `200 { "users": [{ id, name, email, isActive, suspendedUntil, activeBookings, activeBookingRefs, noShows30d }] }` customers only, by name; `activeBookingRefs` = references of the active future bookings, used by the dialog of §4 | 401, 403 |
| `POST /api/staff/users/:id/deactivate` | `{}` | `200 { "user": …, "cancelledBookings": ["BK-…"] }` | 401, 403, 404 (not a customer) |
| `POST /api/staff/users/:id/reactivate` | `{}` | `200 { "user": … }` | 401, 403, 404 |
| `POST /api/bookings`, `POST /api/bookings/:reference/reschedule` (changed) | — | — | adds 409 `BOOKING_SUSPENDED`, checked after BR-02/BR-01 and before BR-03/BR-04 |

## 4. UI (`/staff/users`)

Search box, table (cards on mobile) with status badges, **Deactivate** / **Reactivate** with a dialog naming
the bookings that will be cancelled; the customer's booking page shows the 409 message when suspended.

## 5. Data

No new table: suspension is computed from `BookingStatusChange` (F-10); index `(toStatus, createdAt)` added
for the count. `User.isActive` exists since F-00.

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-79 | `suspendedUntil` returns third-no-show + 7 days while that is after now, considers only the last 30 days, and `null` otherwise (2 no-shows, or the 7 days are over). |
| AC-80 | A customer with 3 NO_SHOW outcomes recorded in the last 30 days cannot book or reschedule (409 `BOOKING_SUSPENDED` with the end date) until 7 days after the third; then booking works again. |
| AC-81 | Deactivating a customer cancels their future BOOKED bookings with reason "account deactivated" and a history row in one transaction, makes their session answer 401 and hides their bookings from the available-slot calculation; reactivating restores login only. |
| AC-82 | `GET /api/staff/users` lists customers only with the computed columns; Customers get 403; a staff id or unknown id → 404. |
| AC-83 | UI: Staff deactivates a customer through the dialog that names the bookings to be cancelled; the row shows Inactive; the customer's next request returns to `/login` with "Your session has ended." |

## 7. Failure / Boundary Cases

Exactly 30 days ago (excluded), third no-show 7 days ago to the minute (suspension over), deactivating an
already inactive account (200, nothing cancelled), a booking that started 10 minutes ago (not cancelled).

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-25 | Yanis Amrane | Sprint 3 contract drafted for Simeon Audouit's Issue (Issue #57); reviewed by Simeon Audouit, the implementer. |
| 1.1 | 2026-11-26 | Simeon Audouit | Issue #61: `activeBookingRefs` added to the list (the §4 dialog names the bookings to be cancelled); suspension date in the 409 message formatted as “Sat 22 Feb 2031, 10:00” (Asia/Bangkok). Found while implementing; reviewed in the #61 PR. |
