# Sprint 1 demo screenshots

Produced by `e2e/demo-evidence.spec.ts` (`SHOT-01`, not part of the AC coverage) with
`npx playwright test e2e/demo-evidence.spec.ts`, at 1280×900 unless stated otherwise, against the E2E database
(reset and seeded by `e2e/global-setup.ts`). Dates are relative to the day of the run ("tomorrow" = today+1,
Asia/Bangkok). The booking read back from PostgreSQL is in [`../demo/db-readback.txt`](../demo/db-readback.txt).

| File | Scenario | Role | Feature / AC | What it shows |
| :--- | :--- | :--- | :--- | :--- |
| `01-login.png` | Open `/login` | anonymous | F-01 / AC-05 | Login form with visible labels |
| `02-customer-home.png` | Ploy logs in | Customer (Ploy) | F-01, F-04 / AC-05 | Lands on `/book`; header with name, role badge, navigation, Log out |
| `03-available-tomorrow.png` | Filter the date to tomorrow | Customer (Ploy) | F-04 / AC-16 | Bookable slots of tomorrow as cards (time, service, staff, Book) |
| `04-booking-dialog.png` | Book Mali 14:00 | Customer (Ploy) | F-04 / AC-22 | Confirmation dialog with slot summary, note and counter |
| `05-booking-confirmation.png` | Confirm | Customer (Ploy) | F-04 / AC-17, AC-22 | "Booked! Reference BK-YYYY-NNNNNN" and link to My Bookings |
| `06-my-bookings-after-reload.png` | Open My Bookings, reload | Customer (Ploy) | F-05 / AC-23, AC-27 | The new booking under Upcoming after a page reload |
| `07-booking-detail.png` | View the booking | Customer (Ploy) | F-05 / AC-23 | Detail card with note, Cancel booking button |
| `08-booking-api-json.png` | Open `/api/bookings/<reference>` in the logged-in browser | Customer (Ploy) | F-05 / AC-23 | The persisted booking as returned by the API (BookingView JSON) |
| `09-limit-rejected.png` | Nina (3 active future bookings made through the API) tries a 4th | Customer (Nina) | F-04 / AC-21 (BR-03) | 409 `BOOKING_LIMIT_REACHED` message inside the dialog |
| `10-overlap-rejected.png` | Ploy books a Mali 09:00 slot overlapping her Anan 09:00 booking | Customer (Ploy) | F-04 / AC-21 (BR-04) | 409 `BOOKING_OVERLAP` message inside the dialog |
| `11-late-cancel-no-button.png` | Open a booking starting in 90 minutes | Customer (Ploy) | F-05 / AC-26, AC-27 (BR-05) | No Cancel button; "Cancellation closes 2 hours before the start." |
| `12-cancellation-success.png` | Cancel the booking of shot 05 | Customer (Ploy) | F-05 / AC-25, AC-27 | Toast "Booking cancelled" and Cancelled badge |
| `13-my-slots-new-slot.png` | Mali publishes today+8 10:00 | Staff (Mali) | F-03 / AC-11, AC-15 | Toast "Slot published" and the new slot in Upcoming slots |
| `14-slot-overlap.png` | Mali publishes 10:15 the same day | Staff (Mali) | F-03 / AC-13 (BR-07) | 409 `SLOT_OVERLAP` "You already have a slot at this time." |
| `15-schedule-mali.png` | Mali's schedule for tomorrow | Staff (Mali) | F-06 / AC-28, AC-29 | Summary line; Ploy's booking with reference, "Ploy Chai" and note |
| `16-schedule-anan.png` | Anan's schedule for the same day | Staff (Anan) | F-06 / AC-29 (BR-09) | Only Anan's slots (his seeded bookings); Ploy's new booking on Mali's slot is absent |
| `17-customer-redirected.png` | Ploy opens `/staff/slots` | Customer (Ploy) | F-02 / AC-10 | Redirected to her home `/book` |
| `18-api-forbidden.png` | Ploy opens `/api/staff/slots` in the browser | Customer (Ploy) | F-02 / AC-07 | `403 { "error": "FORBIDDEN", "message": … }` |
| `19-logout.png` | Log out | Customer (Ploy) | F-01 / AC-04 | Back on `/login` |
| `20-api-unauthenticated.png` | Open `/api/auth/me` after logout | anonymous | F-01, F-02 / AC-04, AC-06 | `401 { "error": "UNAUTHENTICATED", "message": … }` |
| `21-book-320.png` | `/book` at 320 px (full page) | Customer (Ploy) | AC-30 (NFR-08) | Single column, no horizontal scroll |
| `22-book-768.png` | `/book` at 768 px (full page) | Customer (Ploy) | AC-30 (NFR-08) | Two-column filters, card grid |
| `23-book-1280.png` | `/book` at 1280 px (full page) | Customer (Ploy) | AC-30 (NFR-08) | Desktop layout |
