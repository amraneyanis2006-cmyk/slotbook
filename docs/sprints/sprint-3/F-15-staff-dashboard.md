# F-15 — Staff Dashboard (Sprint 3 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-20, BR-08, BR-09, NFR-08, NFR-09, NFR-10 |
| Issue / owner / reviewer | Issue #58 — Yanis Amrane (author), Simeon Audouit (reviewer) |
| Depends on | F-09 (outcomes), F-11 (services) |
| Contract version | 1.0 (2026-11-25) — history in §8 |
| Status | **Implemented early, in Deliverable 2** (the Sprint 3 workflow required by Part C) |

## 1. Behavior and Workflow

1. A Staff member opens **Dashboard** (`/staff/dashboard`, Staff navigation). The period defaults to the
   last 30 days up to today (Asia/Bangkok): **From** = today − 29, **To** = today.
2. The SPA calls `GET /api/staff/dashboard?from=&to=`. The server reads **the caller's own** slots whose
   Bangkok start date is in `[from, to]` (CANCELLED slots excluded), with their booking (BOOKED, COMPLETED or
   NO_SHOW; a cancelled booking does not count) and computes the figures with the pure function of §2.
3. The page shows four tiles (Slots, Booked, Open, No-show rate), the outcomes line ("12 completed · 2 no-show ·
   3 not recorded yet") and the table **Bookings per service** (service, bookings, share of the period's bookings).
4. Changing the period reloads the figures; the period is kept in the URL (`?from=&to=`).

## 2. Pure Rule Function

`computeDashboard(slots, now)` in `server/src/rules/dashboardRules.ts`, where each slot is
`{ status, startAt, service: { id, name }, booking: null | { status } }`:

- `slots.total` = number of slots; `slots.booked` = slots with a booking; `slots.open` = OPEN slots without a
  booking; `slots.closed` = CLOSED slots without a booking (same disjoint counts as F-06);
- `outcomes.completed` / `outcomes.noShow` = bookings COMPLETED / NO_SHOW; `outcomes.pending` = BOOKED bookings
  whose slot has started (outcome not recorded yet); BOOKED bookings in the future are not counted here;
- `noShowRate` = `noShow / (completed + noShow)` rounded to 3 decimals, or `null` when the denominator is 0;
- `perService` = one row per service with at least one booking: `{ serviceId, name, bookings }`, ordered by
  bookings descending, then name.

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/staff/dashboard` | query `from`, `to` (`YYYY-MM-DD`, `to ≥ from`, at most 92 days) | `200 { "from", "to", "slots": { total, booked, open, closed }, "outcomes": { completed, noShow, pending }, "noShowRate": 0.143 \| null, "perService": [{ serviceId, name, bookings }] }` | 401, 403 (Customer), 422 (`from`/`to`: "Enter a valid date (YYYY-MM-DD).", "The end date must be on or after the start date.", "Choose a period of at most 92 days.") |

## 4. UI (`/staff/dashboard`)

Period form (From, To, **Show**); four stat tiles with a text label and the number (the rate as "14.3 %" or
"—" when null, with the sentence "No outcome recorded in this period." under it); outcomes line; table
"Bookings per service" (cards below 768 px). Loading skeleton, empty state "No slots in this period." with a
link to **My Slots**, error callout with Retry. No chart library: figures are text, readable by screen readers.

## 5. Data

No schema change (read-only over `Slot`, `Booking`, `Service`).

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-69 | `computeDashboard` returns the disjoint slot counts, the outcomes with `pending` for started BOOKED bookings, `noShowRate` = noShow / (completed + noShow) rounded to 3 decimals or `null`, and `perService` ordered by bookings then name. |
| AC-70 | `GET /api/staff/dashboard` counts only the caller's non-cancelled slots whose Bangkok date is in `[from, to]` (cancelled bookings ignored); another staff member's slots never count; a Customer gets 403; a bad or too long period gets 422. |
| AC-71 | UI: Staff opens Dashboard, sees the tiles and the per-service table for the default 30 days, changes the period and the figures and URL follow; the page has no horizontal scroll at 320 px. |

## 7. Failure / Boundary Cases

Period of exactly 92 days (allowed) and 93 (422), `from = to`, slot at 00:00 / 23:45 Bangkok on a period edge,
no outcome yet (`noShowRate` null), a slot with a cancelled booking (counted as open or closed by its status),
a service renamed during the period (current name shown).

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-25 | Yanis Amrane | Sprint 3 contract (Issue #57), reviewed by Simeon Audouit before implementation. |
