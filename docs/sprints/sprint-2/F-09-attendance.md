# F-09 — Attendance Outcome (Sprint 2 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-15, BR-15, BR-13, BR-08, BR-09, BR-17, NFR-09, NFR-10 |
| Issue / owner / reviewer | Issue #53 — Simeon Audouit (author), Yanis Amrane (reviewer) |
| Depends on | F-06 (schedule), F-10 (history, staff booking detail) |
| Contract version | 1.0 (2026-11-25) — history in §8 |

## 1. Behavior and Workflow

1. On **Schedule** (`/staff/schedule`) a booked slot whose start time has passed shows two buttons:
   **Completed** and **No-show**. The same buttons are on the staff booking detail
   (`/staff/bookings/:reference`, F-10).
2. A click opens a confirmation dialog ("Record <customer> as No-show for BK-…? This cannot be changed.")
   → `POST /api/staff/bookings/:reference/outcome { "outcome": "COMPLETED" | "NO_SHOW" }`.
3. The server, in one transaction, locks the booking row **joined to a slot with `staffId = req.user.id`**
   (missing or another staff member's slot → 404), then checks, in this order:
   BR-13 `status = BOOKED` (else 409 `BOOKING_NOT_ACTIVE`), BR-15 `now ≥ slot.startAt` (else 409
   `OUTCOME_TOO_EARLY`); then sets the status and appends the history row `BOOKED → <outcome>` with the staff
   member as actor (F-10).
4. An outcome is final in Sprint 2 (no correction endpoint); a wrong click is prevented by the dialog.
5. The schedule summary of F-06 is unchanged: a slot with a COMPLETED or NO_SHOW booking still counts as
   booked. The customer sees the new status badge (Completed / No-show) in **Past and cancelled** and the
   history line on the booking detail.
6. The slot status is not changed (it stays OPEN or CLOSED); the slot is in the past, so BR-02 already
   keeps it out of every customer list.

## 2. Pure Rule Function

`canRecordOutcome(booking, slot, now)` in `server/src/rules/bookingRules.ts` →
`null | 'BOOKING_NOT_ACTIVE' | 'OUTCOME_TOO_EARLY'`; exactly at the start time is allowed (`now ≥ startAt`);
BR-13 is checked before BR-15. Message for `OUTCOME_TOO_EARLY`: "An outcome can be recorded only after the
booking starts."

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `POST /api/staff/bookings/:reference/outcome` | `{ "outcome": "NO_SHOW" }` | `200 { "booking": StaffBookingView, "history": [HistoryEntry…] }` | 401, 403 (Customer), 404, 409 `BOOKING_NOT_ACTIVE` / `OUTCOME_TOO_EARLY`, 422 (outcome not COMPLETED/NO_SHOW: "Choose Completed or No-show.") |

`StaffBookingView` and `HistoryEntry` from F-10. The schedule response of F-06 gains, per booked slot,
`booking.canRecordOutcome: boolean` (true when BOOKED and started), so the client does not compare clocks.

## 4. UI

- `/staff/schedule`: for each slot with `booking.canRecordOutcome`, buttons **Completed** and **No-show**
  (`aria-label` includes the reference); after a record, the row shows the badge and the buttons disappear;
  toast "Outcome recorded". A 409 is shown in a callout and the list refreshes.
- `/staff/bookings/:reference`: same buttons above the History list; the new history line appears after a record.

## 5. Data

No schema change (`COMPLETED`, `NO_SHOW` exist since F-00; history table from F-10).

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-55 | The staff member who owns the slot records COMPLETED (and, on another booking, NO_SHOW) for a BOOKED booking whose slot has started → 200 with the new status and a history row `BOOKED → COMPLETED` / `NO_SHOW` with the staff member as actor; exactly at the start time is allowed. |
| AC-56 | Before the start time → 409 `OUTCOME_TOO_EARLY`; on a CANCELLED, COMPLETED or NO_SHOW booking → 409 `BOOKING_NOT_ACTIVE`; another staff member's booking → 404; a Customer → 403; an invalid outcome → 422. The booking and its history are unchanged in all these cases. |
| AC-57 | `GET /api/staff/schedule` returns `canRecordOutcome` true only for BOOKED bookings that have started; the customer's `GET /api/bookings/mine` lists the recorded booking under `past` with its new status. |
| AC-58 | UI: on Schedule, Staff records No-show for a past booking through the confirmation dialog; the row shows the No-show badge and no more buttons; the customer sees the No-show badge in **Past and cancelled**. |

## 7. Failure / Boundary Cases

One minute before start (409), exactly at start (allowed), long after the slot ended (allowed), double
submission (second → 409 `BOOKING_NOT_ACTIVE`), lower-case reference (normalised), booking cancelled by the
customer then outcome attempted (409 `BOOKING_NOT_ACTIVE`), body `{ "outcome": "BOOKED" }` (422).

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-25 | Yanis Amrane | Sprint 2 contract drafted for Simeon Audouit's Issue, recorded before implementation (Issue #49); reviewed by Simeon Audouit, the implementer. |
