# F-07 — Slot Maintenance (Sprint 2 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-12, FR-13, BR-14, BR-06, BR-07, BR-08, BR-09, BR-11, BR-17, NFR-04, NFR-09 |
| Issue / owner / reviewer | Issue #52 — Simeon Audouit (author), Yanis Amrane (reviewer) |
| Depends on | F-03 (slots), F-05 (booking cancellation), F-10 (history) |
| Contract version | 1.0 (2026-11-25) — history in §8 |

## 1. Behavior and Workflow

A Staff member manages **their own** future slots from **My Slots** (`/staff/slots`). Every action runs in
one transaction that first locks the slot row (`SELECT … FOR UPDATE`) **filtered by `staffId = req.user.id`**
(not found or not owned → 404), then reads its BOOKED booking, then applies the rule of §2.

| Action | Allowed when | Effect |
| :--- | :--- | :--- |
| **Edit time** | slot OPEN or CLOSED, starts after now, **no BOOKED booking** | new `startAt` from `{ date, startTime }`, `endAt = startAt + slot duration` (current `endAt − startAt`, not the service's present duration); BR-06 re-checked (service activity is not re-checked: a slot of a now-inactive service can still be moved); BR-07 re-checked against the staff member's other slots (the slot itself excluded) under the staff row lock of F-03 |
| **Close** | slot OPEN, starts after now, no BOOKED booking | `status = CLOSED`: no longer listed or bookable (BR-02) |
| **Reopen** | slot CLOSED, starts after now | `status = OPEN` |
| **Cancel with reason** | slot OPEN or CLOSED, starts after now | `status = CANCELLED`. If it has a BOOKED booking (BR-14 cascade): booking `status = CANCELLED`, `cancelledAt = now`, `cancelledById = staff`, and one history row `BOOKED → CANCELLED` with the reason (F-10). The reason is required in every case (3–200 characters). |

A CANCELLED slot is final. A slot that has started (start ≤ now) can no longer be changed: its booking is
handled by F-09.

The customer sees the cancellation on **My Bookings** (status Cancelled) and the reason on the booking
detail (F-10 §4 callout). The BR-05 window does not limit Staff: a slot can be cancelled up to its start.

## 2. Pure Rule Function

`checkSlotChange(action, slot, hasBooking, now)` in `server/src/rules/slotRules.ts` →
`null | 'SLOT_NOT_EDITABLE' | 'SLOT_HAS_BOOKING'`, checked in this order:

1. `SLOT_NOT_EDITABLE` — slot CANCELLED, or `slot.startAt ≤ now`, or action `close` on a non-OPEN slot, or
   action `reopen` on a non-CLOSED slot;
2. `SLOT_HAS_BOOKING` — action `edit` or `close` while `hasBooking` (BR-14).

`cancel` never returns `SLOT_HAS_BOOKING`. The edit's new time is then validated by the F-03 functions
`validateSlot` (BR-06) and `findOverlap` (BR-07).

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `PATCH /api/staff/slots/:id` | `{ "date": "2026-12-02", "startTime": "10:15" }` | `200 { "slot": SlotStaffView }` | 401, 403, 404, 409 `SLOT_NOT_EDITABLE` / `SLOT_HAS_BOOKING` / `SLOT_OVERLAP`, 422 `VALIDATION_ERROR` |
| `POST /api/staff/slots/:id/close` | `{}` | `200 { "slot": SlotStaffView }` `status: "CLOSED"` | 401, 403, 404, 409 `SLOT_NOT_EDITABLE` / `SLOT_HAS_BOOKING` |
| `POST /api/staff/slots/:id/reopen` | `{}` | `200 { "slot": SlotStaffView }` `status: "OPEN"` | 401, 403, 404, 409 `SLOT_NOT_EDITABLE` |
| `POST /api/staff/slots/:id/cancel` | `{ "reason": "Staff illness" }` | `200 { "slot": SlotStaffView, "cancelledBooking": null \| "BK-2026-000014" }` | 401, 403, 404, 409 `SLOT_NOT_EDITABLE`, 422 (reason missing, < 3 or > 200 characters) |

Messages: `SLOT_NOT_EDITABLE` "This slot can no longer be changed."; `SLOT_HAS_BOOKING` "This slot is booked.
Cancel it with a reason instead."; reason field: "Enter a reason of 3 to 200 characters.".
`:id` that is not a positive integer → 404 (same answer as not owned). `staffId` in a body is ignored (BR-08).

## 4. UI (`/staff/slots`)

Each upcoming slot card/row gets an **Actions** menu button (keyboard reachable, `aria-haspopup`):

- **Edit time** (hidden when booked): dialog with Date and Start time (same controls as the create form,
  pre-filled), "Ends at …" preview, server errors under the fields, 409 in a callout; toast "Slot updated".
- **Close** / **Reopen** (by status, hidden when booked): no dialog; toast "Slot closed" / "Slot reopened".
- **Cancel slot**: dialog with a required Reason textarea (counter 0/200). When booked, the dialog says
  "The booking BK-… of <customer> will be cancelled and the customer will see your reason."; toast
  "Slot cancelled" and the slot leaves the list.

The list refreshes after each action. A booked slot shows only **Cancel slot**.

## 5. Data

No schema change (`Slot.status` CLOSED/CANCELLED exist since F-00; history table from F-10).

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-49 | A Staff member moves an own unbooked future slot to a valid free time → 200 with the new times (same duration); a new time that breaks BR-06 → 422 with the F-03 field messages; one that overlaps another own non-cancelled slot → 409 `SLOT_OVERLAP`; moving a slot within its own old range (e.g. +15 min) is allowed. |
| AC-50 | Close: an own OPEN unbooked future slot → CLOSED and absent from `GET /api/slots/available`; booking it → 409 `SLOT_NOT_BOOKABLE`; Reopen makes it listed and bookable again. |
| AC-51 | Editing or closing an own slot that has a BOOKED booking → 409 `SLOT_HAS_BOOKING` and nothing changes (BR-14). |
| AC-52 | Cancelling an own booked slot with a reason → slot CANCELLED, booking CANCELLED with `cancelledAt`, one history row `BOOKED → CANCELLED` with the staff member as actor and the reason, all in one transaction; the customer's `GET /api/bookings/:reference` shows the status and the reason in `history`. Without a reason → 422 and nothing changes. |
| AC-53 | Any action on a slot that started, or on a CANCELLED slot → 409 `SLOT_NOT_EDITABLE`; on another staff member's slot → 404 and nothing changes; a Customer → 403. |
| AC-54 | UI: Staff cancels a booked slot with the reason "Staff illness" through the dialog; the customer then sees the Cancelled badge and "Cancelled by <staff>: Staff illness" on the booking detail. Staff closes and reopens an open slot from the Actions menu with the keyboard only. |

## 7. Failure / Boundary Cases

Slot starting in 1 minute (still changeable), exactly now (not), edit to a time in the past (422 "The slot must
start in the future."), edit to the same time (200, no change), close an already CLOSED slot (409
`SLOT_NOT_EDITABLE`), cancel the same slot twice (second → 409), reason of 3 / 200 characters (accepted) and
2 / 201 (422), concurrent customer booking and staff close on the same slot (the slot row lock serialises
them: either the close sees the booking → 409, or the booking sees CLOSED → 409 `SLOT_NOT_BOOKABLE`).

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-25 | Yanis Amrane | Sprint 2 contract drafted for Simeon Audouit's Issue, recorded before implementation (Issue #49); reviewed by Simeon Audouit, the implementer. |
