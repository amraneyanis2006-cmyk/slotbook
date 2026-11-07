# F-05 — My Bookings and Cancellation (Sprint 1 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-09, FR-10, BR-05, BR-08, BR-09, BR-11, BR-13, NFR-08, NFR-09 |
| Issue / owner / reviewer | Issue #6 — Simeon Audouit (author), Yanis Amrane (reviewer) |
| Depends on | F-04 |
| Contract version | 1.0 (2026-11-07) |

## 1. Behavior and Workflow

1. The Customer opens **My Bookings** (`/bookings`): section **Upcoming** (BOOKED with start ≥ now,
   ascending) and section **Past and cancelled** (everything else, newest start first).
2. Each row shows reference, date/time, service, staff, status badge; **View** opens
   `/bookings/:reference` (detail with note and cancellation time).
3. **Cancel booking** is shown only when the booking is BOOKED and starts in ≥ 2 h. It opens a
   confirmation dialog → `POST /api/bookings/:reference/cancel`.
4. The server, in one transaction, loads the booking **by reference and `customerId = req.user.id`**
   with `FOR UPDATE` (not found or not owned → 404), checks BR-13 (status BOOKED else 409
   `BOOKING_NOT_ACTIVE`) and BR-05 (`slot.startAt - now ≥ 2 h` else 409 `CANCELLATION_WINDOW_CLOSED`),
   then sets `status = CANCELLED`, `cancelledAt = now`, `cancelledById = req.user.id`.
5. The slot is bookable again automatically (BR-11: the partial unique index only counts BOOKED rows).
6. The data is read from the database on every visit: a reload or a new login shows the same bookings.

## 2. Pure Rule Function

`canCustomerCancel(booking, slot, now)` in `server/src/rules/bookingRules.ts` → `null |
'BOOKING_NOT_ACTIVE' | 'CANCELLATION_WINDOW_CLOSED'` (`CANCEL_WINDOW_MIN = 120`, exactly 120 min →
allowed). BR-13 is checked before BR-05.

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/bookings/mine` | — | `200 { "upcoming": [BookingView…], "past": [BookingView…] }` own bookings only | 401, 403 (Staff) |
| `GET /api/bookings/:reference` | — | `200 { "booking": BookingView }` | 401, 403, 404 (missing or other customer's) |
| `POST /api/bookings/:reference/cancel` | `{}` | `200 { "booking": BookingView }` with `status: "CANCELLED"`, `cancelledAt` | 401, 403, 404, 409 `BOOKING_NOT_ACTIVE`, 409 `CANCELLATION_WINDOW_CLOSED` |

`BookingView` as defined in F-04.

## 4. UI

- `/bookings`: two sections, status badges (Booked / Cancelled / Completed / No-show), **View**, loading,
  empty "You have no bookings yet. Book a slot." (link to `/book`), error + Retry.
- `/bookings/:reference`: detail card; **Cancel booking** (only when allowed, otherwise the reason
  "Cancellation closes 2 hours before the start."), confirmation dialog, success toast and refreshed
  status; 404 page "Booking not found." for other customers' references.

## 5. Data

No schema change (`cancelledAt`, `cancelledById` exist since F-00).

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-23 | `GET /api/bookings/mine` returns only the caller's bookings, split and ordered as specified; `GET /api/bookings/:reference` returns the caller's booking; data are unchanged after a new login. |
| AC-24 | Reading or cancelling another customer's booking by reference → 404 `NOT_FOUND` with no booking data, and the booking is unchanged. |
| AC-25 | Cancelling an own BOOKED booking that starts in ≥ 2 h → 200 `CANCELLED` with `cancelledAt`; the slot appears again in `GET /api/slots/available` and can be booked by another customer. |
| AC-26 | Cancelling less than 2 h before the start → 409 `CANCELLATION_WINDOW_CLOSED`; cancelling a CANCELLED/COMPLETED/NO_SHOW booking → 409 `BOOKING_NOT_ACTIVE`; the booking is unchanged in both cases. |
| AC-27 | UI: the Customer sees the new booking in **My Bookings** after a page reload, cancels it through the dialog and sees the Cancelled badge; the Cancel button is not offered inside the 2-hour window. |

## 7. Failure / Boundary Cases

Exactly 120 min before start (allowed), 119 min (rejected), double cancel (second → 409
`BOOKING_NOT_ACTIVE`), lower-case reference in URL (normalised to upper case), Staff calling the
endpoints (403).
