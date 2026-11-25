# F-10 — Booking History (Sprint 2 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-16, BR-17, BR-08, BR-09, NFR-06, NFR-10 |
| Issue / owner / reviewer | Issue #50 — Yanis Amrane (author), Simeon Audouit (reviewer) |
| Depends on | F-05 (cancel), F-04 (book). **Lands first in Sprint 2**: F-07, F-08 and F-09 write history through it. |
| Contract version | 1.1 (2026-11-25) — history in §8 |

## 1. Behavior and Workflow

1. Every change of a booking's status appends **one** `BookingStatusChange` row **inside the same
   transaction** as the change. If the history insert fails, the status change is rolled back.
2. The writers in Sprint 2 and the row each one appends:

   | Event | Feature | `fromStatus` → `toStatus` | `actorId` | `reason` |
   | :--- | :--- | :--- | :--- | :--- |
   | Booking created | F-04 | `null` → `BOOKED` | the Customer | `null` |
   | Customer cancels | F-05 | `BOOKED` → `CANCELLED` | the Customer | `null` |
   | Staff cancels a booked slot | F-07 | `BOOKED` → `CANCELLED` | the Staff member | the reason typed by Staff |
   | Outcome recorded | F-09 | `BOOKED` → `COMPLETED` / `NO_SHOW` | the Staff member | `null` |
   | Reschedule, old booking | F-08 | `BOOKED` → `CANCELLED` | the Customer | `Rescheduled to BK-…` |
   | Reschedule, new booking | F-08 | `null` → `BOOKED` | the Customer | `Rescheduled from BK-…` |

3. All writers call one helper, `recordStatusChange(tx, { bookingId, from, to, actorId, reason, at })` in
   `server/src/services/historyService.ts`. No other code inserts into the table; no code updates or deletes it.
4. **Append-only is also enforced by the database** (BR-17): a trigger raises an exception on any direct
   `UPDATE` or `DELETE` of `BookingStatusChange`. The only exception is the cascade from deleting the booking
   itself (`pg_trigger_depth() > 1`), which the application never does; only test helpers delete bookings.
5. **Backfill.** The migration that creates the table adds the history of the bookings that already exist,
   so production keeps a complete history:
   - every booking: `null → BOOKED`, actor = customer, time = `createdAt`;
   - `CANCELLED`: `BOOKED → CANCELLED`, actor = `cancelledById` (customer if null), time = `cancelledAt`;
   - `COMPLETED` / `NO_SHOW` (seed only): `BOOKED → <status>`, actor = slot staff, time = slot `endAt`;
   - the time of a second row is never earlier than the booking's `createdAt` (`GREATEST`), so the history
     reads in order even for seed bookings created after their slot ended;
   - backfilled rows carry `reason = 'Recorded before history (Sprint 1)'` for the second row only, so a
     reader can tell them apart. The SQL lives in `server/prisma/sql/backfill-history.sql`; the migration contains
     the same text between `-- backfill:start` / `-- backfill:end` (DB-06 checks they match) and the seed runs the
     file after creating its bookings. It only fills bookings that have no history, so reruns add nothing.
6. The Customer sees the history on the booking detail (`/bookings/:reference`); the Staff member who owns the
   slot sees it on the new staff booking detail (`/staff/bookings/:reference`). Both are read-only timelines.

## 2. Pure Rule Function

`toHistoryView(rows)` in `server/src/rules/historyRules.ts` orders rows by `createdAt`, then `id`
(ascending) and maps each to `HistoryEntry` (below). It never includes e-mail addresses or ids of users.
`isValidTransition(from, to)` → `boolean` lists the only allowed pairs (table §1 step 2); the helper of step
3 throws an internal error (500, logged) for any other pair, so a programming error cannot write a false history.

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/bookings/:reference` (changed) | — | `200 { "booking": BookingView, "history": [HistoryEntry…] }` | 401, 403 (Staff), 404 (missing or other customer's) |
| `GET /api/staff/bookings/:reference` (new) | — | `200 { "booking": StaffBookingView, "history": [HistoryEntry…] }` only when the booking's slot belongs to the caller | 401, 403 (Customer), 404 (missing or another staff member's slot) |

```json
HistoryEntry     = { "at": "…Z", "from": null | "BOOKED", "to": "CANCELLED",
                     "actor": { "name": "Anan Wong", "role": "STAFF" }, "reason": null | "…" }
StaffBookingView = BookingView + { "customer": { "id": 3, "name": "Ploy Chai" } }
```

The existing fields of `BookingView` are unchanged, so the Sprint 1 client keeps working.

## 4. UI

- `/bookings/:reference`: section **History** under the detail card: an ordered list (`<ol>`), one line per
  entry: date/time (Bangkok), "Booked", "Cancelled", "Completed" or "No-show", "by <name> (Staff|Customer)",
  and the reason in a quote block when present. A booking cancelled by staff also shows a callout at the top:
  "Cancelled by <staff name>: <reason>" (FR-13).
- `/staff/bookings/:reference` (new, Staff): same card with the customer name and the same History list.
  Reached from **Schedule** (reference becomes a link). Loading skeleton, 404 page "Booking not found.",
  error callout with Retry.

## 5. Data

New table (migration `…_booking_history`):

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | serial PK | |
| `bookingId` | int FK → `Booking.id` | `ON DELETE CASCADE` (see §1 step 4); index `(bookingId, createdAt)` |
| `fromStatus` | `BookingStatus` nullable | `null` = creation |
| `toStatus` | `BookingStatus` | |
| `actorId` | int FK → `User.id` | |
| `reason` | varchar(200) nullable | |
| `createdAt` | timestamptz | set from `now()` of `utils/clock` (frozen in tests) |

Raw SQL in the same migration: the backfill of §1 step 5 and the trigger
`booking_history_append_only BEFORE UPDATE OR DELETE … RAISE EXCEPTION 'BookingStatusChange is append-only'`
(skipped only when `pg_trigger_depth() > 1`, i.e. the cascade of §1 step 4).

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-40 | Booking a slot (F-04) and cancelling it (F-05) each append exactly one history row with the from/to, actor and time of §1 step 2, in the same transaction: a booking that fails a rule (409) leaves no history row. |
| AC-41 | `GET /api/bookings/:reference` returns `history` ordered oldest first for the caller's booking; `GET /api/staff/bookings/:reference` returns it to the staff member who owns the slot; another customer or another staff member gets 404 with no data; the wrong role gets 403. |
| AC-42 | An `UPDATE` or `DELETE` on `BookingStatusChange` is refused by the database; after the migration every existing booking has a history that ends in its current status (backfill). |
| AC-43 | UI: the customer's booking detail shows the History list with "Booked by <name> (Customer)" after booking and a second line after cancelling; the staff booking detail opened from Schedule shows the same entries. |

## 7. Failure / Boundary Cases

Two status changes in the same second (order by `id`), history of a booking cancelled before Sprint 2
(backfilled row with the marker reason), deactivated actor (name still shown), reference in lower case
(normalised), a booking with only its creation row, a database without bookings (backfill inserts nothing).

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-25 | Yanis Amrane | Sprint 2 contract, recorded before implementation (Issue #49), reviewed by Simeon Audouit. |
| 1.1 | 2026-11-25 | Yanis Amrane | Issue #50: §1 step 5 backfill times use `GREATEST(createdAt, …)` (a seed booking of a past slot is created after the slot ended, which put its outcome before its creation) and the backfill SQL is one file shared by the migration and the seed. Found while writing DB-06. Behavior of the API unchanged. |
