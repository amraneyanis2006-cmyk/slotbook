# F-03 — Staff Publishes Slots (Sprint 1 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-05, FR-06, BR-06, BR-07, BR-08, BR-09, NFR-08, NFR-09, NFR-10 |
| Issue / owner / reviewer | Issue #4 — Yanis Amrane (author), Simeon Audouit (reviewer) |
| Depends on | F-02 |
| Contract version | 1.0 (2026-11-07) |

## 1. Behavior and Workflow

1. A Staff member opens **My Slots** (`/staff/slots`), their home page.
2. They choose a service (active services only), a date and a start time (15-minute steps, 08:00–17:45)
   and press **Publish slot**.
3. The server computes `endAt = startAt + service.durationMin`, validates BR-06, then in a transaction
   locks the staff user row (`SELECT … FOR UPDATE`) and checks BR-07 (no overlap with own non-cancelled
   slots), then inserts the slot with `staffId = req.user.id`, `status = OPEN`.
4. The new slot appears in the **Upcoming slots** list (start ≥ now, ordered by start), each with
   service, time range, status badge and, when booked, the booking reference and customer name.

## 2. Business Rules and Validation (pure function `validateSlot(input, service, now)` in `server/src/rules/slotRules.ts`)

| Rule | Check | Error |
| :--- | :--- | :--- |
| BR-06a | `serviceId` exists and service is active | 422 `fields.serviceId` "Choose an active service." |
| BR-06b | `date` is `YYYY-MM-DD`, `startTime` is `HH:mm` on a 15-minute boundary | 422 `fields.date` / `fields.startTime` |
| BR-06c | `startAt` > now | 422 `fields.startTime` "The slot must start in the future." |
| BR-06d | `startAt` ≥ 08:00 and `endAt` ≤ 18:00 Asia/Bangkok, same day | 422 `fields.startTime` "Slots must be within opening hours (08:00–18:00)." |
| BR-07 | No own slot with status ≠ CANCELLED where `existing.startAt < new.endAt AND new.startAt < existing.endAt` (touching edges allowed) | 409 `SLOT_OVERLAP` "You already have a slot at this time." |
| BR-08 | `staffId` taken from the session; any `staffId` in the body is ignored | — |

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/services` | — | `200 { "services": [ { "id": 1, "name": "Academic advising", "durationMin": 30 } ] }` (active, by name) | 401 |
| `POST /api/staff/slots` | `{ "serviceId": 1, "date": "2026-11-10", "startTime": "09:30" }` | `201 { "slot": SlotStaffView }` | 401, 403, 422 `VALIDATION_ERROR`, 409 `SLOT_OVERLAP` |
| `GET /api/staff/slots` | — | `200 { "slots": [SlotStaffView…] }` own slots with `startAt ≥ now`, status ≠ CANCELLED, ordered `startAt`, `id` | 401, 403 |

```json
SlotStaffView = {
  "id": 12, "startAt": "2026-11-10T02:30:00.000Z", "endAt": "2026-11-10T03:00:00.000Z",
  "status": "OPEN",
  "service": { "id": 1, "name": "Academic advising", "durationMin": 30 },
  "booking": null | { "reference": "BK-2026-000014", "status": "BOOKED",
                      "customer": { "id": 3, "name": "Ploy Chai" } }
}
```

## 4. UI (`/staff/slots`)

- Form "Publish a slot": Service (select), Date (`type=date`, min today), Start time (select of
  08:00–17:45 by 15 min, end time preview "Ends at 10:00"). Field errors under fields; 409 shown in a
  callout; on success a toast "Slot published" and the list refreshes; form keeps service and date.
- List "Upcoming slots": cards (mobile) / table (≥ 768 px): date, time range, service, status badge
  (Open / Booked / Closed), booking ref + customer when booked. Loading skeleton, empty state "You have
  no upcoming slots. Publish one above.", error callout with Retry.

## 5. Data

No schema change (uses `Slot`, `Service`).

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-11 | A Staff member posts a valid slot → 201; the slot is stored with `staffId` = the session user, `status` OPEN and `endAt` = start + service duration, and it appears in `GET /api/staff/slots`. |
| AC-12 | A slot in the past, not on a 15-minute boundary, outside 08:00–18:00 Asia/Bangkok, or for an unknown/inactive service → 422 `VALIDATION_ERROR` with the field; nothing is stored. |
| AC-13 | A slot overlapping one of the staff member's own non-cancelled slots → 409 `SLOT_OVERLAP`, nothing stored; the same time for **another** staff member is accepted; a slot that starts exactly when another ends is accepted. |
| AC-14 | `GET /api/staff/slots` returns only the caller's upcoming non-cancelled slots, ordered by start, with the booking summary for booked slots. |
| AC-15 | UI: the Staff member publishes a slot from **My Slots**, sees field errors for an invalid choice and the new slot in the list; loading, empty and error states are shown as specified. |

## 7. Failure / Boundary Cases

Slot ending exactly at 18:00 (accepted), starting 17:45 with a 30-min service (rejected), 07:45 (rejected),
date today with start already passed (rejected), two parallel requests creating overlapping slots for the
same staff (one 201, one 409 — row lock).
