# F-08 — Reschedule a Booking (Sprint 2 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-14, BR-16, BR-01..BR-05, BR-08, BR-09, BR-10, BR-11, BR-13, BR-17, NFR-04, NFR-09 |
| Issue / owner / reviewer | Issue #54 — Yanis Amrane (author), Simeon Audouit (reviewer) |
| Depends on | F-04 (booking rules), F-05 (cancellation), F-10 (history) |
| Contract version | 1.0 (2026-11-25) — history in §8 |

## 1. Behavior and Workflow

1. On the booking detail (`/bookings/:reference`), **Reschedule** is shown exactly when **Cancel booking** is
   shown (BOOKED and start ≥ 24 h away). It opens `/bookings/:reference/reschedule`.
2. The page shows the current booking and a date picker (default: the booking's date) listing the bookable
   slots **of the same service** for that day (`GET /api/slots/available?date=&serviceId=`), the current slot
   excluded. The customer picks one and confirms in a dialog.
3. `POST /api/bookings/:reference/reschedule { "slotId": 31 }`. The server runs **one transaction** (BR-16):
   1. lock the old booking **by reference and `customerId = req.user.id`** (`FOR UPDATE`; missing or not
      owned → 404);
   2. BR-13 (BOOKED, else 409 `BOOKING_NOT_ACTIVE`) and BR-05 on the **old** booking (≥ 24 h before its
      start, else 409 `CANCELLATION_WINDOW_CLOSED`), because rescheduling releases the old slot (SRS A-05);
   3. load the target slot (missing → 404 "Slot not found.") and check it: a slot id equal to the old slot → 422 `slotId` "Choose a different slot."; a slot of
      another service → 422 `slotId` "Choose a slot of the same service.";
   4. cancel the old booking (`CANCELLED`, `cancelledAt`, `cancelledById` = customer) and append its history
      row with reason `Rescheduled to <new reference>`;
   5. book the new slot with **the same function and order as F-04** (`bookInTx`: lock slot, lock user,
      BR-02, BR-01, BR-03, BR-04). Because the old booking is already cancelled inside the transaction, it is
      excluded from BR-03 and BR-04, as BR-16 requires;
   6. append the history row of the new booking with reason `Rescheduled from <old reference>`; the note
      of the old booking is copied.
   If any check fails, the transaction is rolled back: the old booking is still BOOKED, with no new history
   row, and no new booking or reference exists (a sequence number may be consumed; gaps are allowed by BR-10).
4. The new booking has its own reference (BR-10: references are immutable). The response gives both.
   The old slot is bookable again (BR-11).
5. Success redirects to `/bookings/<new reference>` with the toast "Booking moved to Tue 2 Dec 2026, 10:30".

## 2. Pure Rule Function

`checkRescheduleTarget(oldSlot, newSlot)` in `server/src/rules/bookingRules.ts` →
`null | { slotId: string }` (same slot, other service). The other checks reuse `canCustomerCancel` (F-05),
`isBookable` and `checkCustomerLimits` (F-04) without change; `book()` of F-04 is refactored into
`bookInTx(tx, customerId, slotId, note, at)` used by both endpoints, with no change to F-04's behavior.

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `POST /api/bookings/:reference/reschedule` | `{ "slotId": 31 }` | `201 { "booking": BookingView, "previous": "BK-2026-000014" }` (new booking BOOKED) | 401, 403 (Staff), 404 (booking missing/not owned, or slot missing), 409 `BOOKING_NOT_ACTIVE` / `CANCELLATION_WINDOW_CLOSED` / `SLOT_NOT_BOOKABLE` / `SLOT_ALREADY_BOOKED` / `BOOKING_LIMIT_REACHED` / `BOOKING_OVERLAP`, 422 (`slotId` not a positive int, same slot, other service) |

Error order = §1 step 3. `customerId` in the body is ignored (BR-08).

## 4. UI (`/bookings/:reference/reschedule`)

Header "Reschedule BK-…" with the current date/time, service and staff; date input with previous/next day
buttons; list of slots (time, staff) as radio cards; **Move booking** button (disabled until a slot is
chosen) → confirmation dialog "Move your booking from <old> to <new>?"; a 409/422 is shown in a callout and
the list refreshes; loading skeleton, empty "No other slot of this service on this day. Try another date.",
404 page for other customers' references.

## 5. Data

No schema change. The link between the two bookings is kept in their history reasons (F-10).

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-59 | Rescheduling an own BOOKED booking (≥ 24 h ahead) to a bookable slot of the same service → 201: the old booking is CANCELLED, a new BOOKED booking exists for the new slot with a new reference and the same note, both history rows have the reasons of §1, and the old slot is listed again by `GET /api/slots/available`. |
| AC-60 | Atomicity (BR-16): when the target slot is not bookable (CLOSED, < 60 min ahead, inactive service), already booked, or the move breaks BR-03/BR-04, the answer is the F-04 error code and **nothing changes**: the old booking is still BOOKED with the same history, and no new booking exists. |
| AC-61 | The old booking is excluded from the checks: a customer holding 3 active bookings can move one of them; a booking can be moved to a slot that overlaps its own old time (e.g. 15 minutes later with another staff member). |
| AC-62 | Less than 24 h before the old start → 409 `CANCELLATION_WINDOW_CLOSED`; a CANCELLED/COMPLETED/NO_SHOW booking → 409 `BOOKING_NOT_ACTIVE`; another customer's reference → 404; same slot or other service → 422; a Staff member → 403. Nothing changes. |
| AC-63 | UI: the customer opens a booking, chooses **Reschedule**, picks another slot of the same service, confirms, lands on the new booking's detail and sees the old one as Cancelled with "Rescheduled to BK-…" in its history. |

## 7. Failure / Boundary Cases

Exactly 24 h before the old start (allowed), 23 h 59 min (409), target exactly 60 min ahead (allowed) and
59 min (409), two concurrent reschedules of the same booking (the booking row lock serialises them: the
second gets 409 `BOOKING_NOT_ACTIVE`), concurrent booking of the target slot by another customer (one wins,
the other gets 409 `SLOT_ALREADY_BOOKED`, the loser's old booking is unchanged), target slot id that does not
exist (404 "Slot not found."), lower-case reference (normalised).

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-25 | Yanis Amrane | Sprint 2 contract, recorded before implementation (Issue #49), reviewed by Simeon Audouit. |
