# F-04 — Browse and Book a Slot (Sprint 1 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-07, FR-08, BR-01, BR-02, BR-03, BR-04, BR-08, BR-10, NFR-04, NFR-08, NFR-09 |
| Issue / owner / reviewer | Issue #5 — Simeon Audouit (author), Yanis Amrane (reviewer) |
| Depends on | F-03 (slots), F-02 (access) |
| Contract version | 1.0 (2026-11-07) |

## 1. Behavior and Workflow (the Sprint 1 domain transaction)

1. A Customer opens **Book a Slot** (`/book`, their home). The date defaults to today (Asia/Bangkok);
   an optional service filter is available.
2. The SPA calls `GET /api/slots/available?date=…&serviceId=…`; the list shows bookable slots ordered by
   start: time range, service, staff name, **Book** button.
3. **Book** opens a confirmation dialog (slot summary + optional note ≤ 300 chars) → **Confirm booking**.
4. The server runs `bookingService.book(customerId = req.user.id, slotId, note)` in **one transaction**:
   1. `SELECT … FROM "Slot" WHERE id = $1 FOR UPDATE` → missing → 404 `NOT_FOUND`.
   2. `SELECT … FROM "User" WHERE id = customerId FOR UPDATE` (serialises the customer's own bookings).
   3. BR-02: `status = OPEN` and `startAt ≥ now + 60 min`, else 409 `SLOT_NOT_BOOKABLE`.
   4. BR-01: no `BOOKED` booking on the slot, else 409 `SLOT_ALREADY_BOOKED`.
   5. BR-03: customer's `BOOKED` bookings with slot `startAt > now` < 3, else 409 `BOOKING_LIMIT_REACHED`.
   6. BR-04: no own `BOOKED` booking overlapping the slot time, else 409 `BOOKING_OVERLAP`.
   7. Insert the booking with `reference = 'BK-' || year || '-' || lpad(nextval('booking_ref_seq'), 6, '0')`
      (BR-10), `status = BOOKED`.
   8. If the insert hits the partial unique index (Prisma `P2002`) → 409 `SLOT_ALREADY_BOOKED` (NFR-04).
5. Success: the dialog shows "Booked! Reference BK-2026-000015" with a link to **My Bookings**; the slot
   disappears from the available list (list refreshed). A rule rejection shows the server message in the
   dialog and refreshes the list.

The rule order above is binding (it decides which error wins when several rules fail).

## 2. Pure Rule Functions (`server/src/rules/bookingRules.ts`, unit-tested with a fixed clock)

- `isBookable(slot, now)` → `null | 'SLOT_NOT_BOOKABLE'` (BR-02, lead time constant `BOOKING_LEAD_MIN = 60`).
- `checkCustomerLimits(activeFutureBookings, slot)` → `null | 'BOOKING_LIMIT_REACHED' | 'BOOKING_OVERLAP'`
  (BR-03 with `MAX_ACTIVE_BOOKINGS = 3`, BR-04 overlap = `a.start < b.end && b.start < a.end`).
- `formatReference(year, seq)` → `BK-2026-000015` (BR-10).

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/slots/available` | query `date=YYYY-MM-DD` (required), `serviceId` (optional int) | `200 { "slots": [SlotPublicView…] }`: status OPEN, start ≥ now + 60 min, inside that Bangkok day, no BOOKED booking, active service; ordered `startAt`, `id` | 401, 403 (Staff), 422 (bad date/serviceId) |
| `POST /api/bookings` | `{ "slotId": 12, "note": "Question about credit transfer" }` | `201 { "booking": BookingView }` | 401, 403 (Staff), 404 `NOT_FOUND`, 409 `SLOT_NOT_BOOKABLE` / `SLOT_ALREADY_BOOKED` / `BOOKING_LIMIT_REACHED` / `BOOKING_OVERLAP`, 422 (slotId not a positive int, note > 300) |

```json
SlotPublicView = { "id": 12, "startAt": "…Z", "endAt": "…Z",
                   "service": { "id": 1, "name": "Academic advising", "durationMin": 30 },
                   "staff": { "id": 1, "name": "Anan Wong" } }
BookingView    = { "reference": "BK-2026-000015", "status": "BOOKED", "note": "…",
                   "createdAt": "…Z", "cancelledAt": null,
                   "slot": { "id": 12, "startAt": "…Z", "endAt": "…Z",
                             "service": { "id": 1, "name": "Academic advising", "durationMin": 30 },
                             "staff": { "id": 1, "name": "Anan Wong" } } }
```

`SlotPublicView` never contains customer data. `customerId` in the body is ignored (BR-08).

## 4. UI (`/book`)

Date input + service select (with "All services"), slot cards (time, service, staff, **Book**), booking
dialog (focus trap, Esc, note textarea with counter, **Confirm booking** busy-disabled), success state
with reference, error callout inside the dialog for 409/422, loading skeleton, empty state "No available
slots on this day. Try another date.", error callout + Retry.

## 5. Data

No schema change: uses `Booking`, the partial unique index and `booking_ref_seq` from F-00.

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-16 | `GET /api/slots/available?date=` returns only OPEN slots of that Bangkok day starting ≥ 60 min from now, without an active booking and with an active service, ordered by start, filtered by `serviceId` when given; Staff → 403. |
| AC-17 | A Customer books a bookable slot → 201 with a `BOOKED` booking whose reference matches `^BK-\d{4}-\d{6}$`, owned by the session customer; the slot no longer appears in the available list. |
| AC-18 | Booking a slot that already has an active booking → 409 `SLOT_ALREADY_BOOKED`; the database still holds exactly one `BOOKED` booking for that slot. |
| AC-19 | Two Customers booking the same slot **in parallel** → exactly one 201 and one 409; one active booking stored (NFR-04). The database itself rejects a second `BOOKED` row for the slot. |
| AC-20 | A slot starting in less than 60 minutes, or CLOSED/CANCELLED → 409 `SLOT_NOT_BOOKABLE`; an unknown slot → 404; nothing stored. |
| AC-21 | A Customer with 3 active future bookings → 409 `BOOKING_LIMIT_REACHED`; a booking overlapping one of the customer's own active bookings → 409 `BOOKING_OVERLAP`; nothing stored. |
| AC-22 | UI: the Customer filters by date/service, books a slot through the dialog and sees the reference; a rule rejection shows the server message and the list is refreshed. |

## 7. Failure / Boundary Cases

Slot starting exactly 60 min from now (bookable), 59 min (not), third booking (allowed) vs fourth
(rejected), past/cancelled bookings not counted in BR-03, back-to-back own bookings (allowed), staff
cannot book (403), note of exactly 300 chars (accepted).
