# F-06 — Staff Daily Schedule (Sprint 1 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-11, BR-08, BR-09, NFR-08, NFR-09 |
| Issue / owner / reviewer | Issue #7 — Simeon Audouit (author), Yanis Amrane (reviewer) |
| Depends on | F-04 (bookings exist), F-03 |
| Contract version | 1.2 (2026-11-10) |

## 1. Behavior and Workflow

1. A Staff member opens **Schedule** (`/staff/schedule`); the date defaults to today (Asia/Bangkok).
2. The SPA calls `GET /api/staff/schedule?date=…`; the server returns the caller's own slots of that
   Bangkok day (all statuses except CANCELLED), ordered by start, each with its BOOKED, COMPLETED or NO_SHOW
   booking (if any; cancelled bookings are not shown).
3. The page shows a time-ordered list: time range, service, status, and for booked slots the booking
   reference, customer name and note. Summary line: "7 slots · 4 booked · 2 open · 1 closed".
4. Changing the date reloads the list. Another staff member's slots are never included.

## 2. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/staff/schedule` | query `date=YYYY-MM-DD` (required) | `200 { "date": "2026-11-10", "slots": [SlotStaffView…], "summary": { "total": 7, "booked": 4, "open": 2, "closed": 1 } }` | 401, 403 (Customer), 422 (bad date) |

`SlotStaffView` from F-03; the booking summary also includes `note` for the schedule.

Summary: `booked` = slots with a BOOKED, COMPLETED or NO_SHOW booking; `open` = OPEN slots without one;
`closed` = CLOSED slots without one; `total` = `booked` + `open` + `closed` (the three counts are disjoint, so
`total` is the number of listed slots; a CLOSED slot with a finished booking counts as booked).

## 3. UI (`/staff/schedule`)

Date input with previous/next day buttons, summary line, list (cards on mobile, table ≥ 768 px),
loading, empty "No slots on this day." with a link to **My Slots**, error + Retry.

## 4. Data

No schema change.

## 5. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-28 | `GET /api/staff/schedule?date=` returns only the caller's non-cancelled slots of that Bangkok day, ordered by start, with reference, customer name and note for booked slots and a correct summary `{ total, booked, open, closed }` (§2); a Customer gets 403; an invalid date gets 422. |
| AC-29 | UI: after a Customer books a slot, the Staff member who owns it sees the booking (reference + customer) on **Schedule** for that day; the other Staff member does not. |

## 6. Cross-Cutting Sprint 1 Acceptance (verified in Issue #7)

| AC | Criterion |
| :--- | :--- |
| AC-30 | The Sprint 1 screens (`/login`, `/book`, `/bookings`, `/staff/slots`, `/staff/schedule`) have no horizontal page scroll and no clipped control at 320, 768 and 1280 px; login and booking can be completed with the keyboard only, with a visible focus ring (NFR-08, NFR-09). |
