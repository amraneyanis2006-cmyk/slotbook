# CR-01 — Impact analysis (BR-05 cancellation cutoff 2 h → 24 h)

Prepared 2026-11-25 by Yanis Amrane, before implementation; reviewed by Simeon Audouit in the contract PR #46
(review points 1–3 addressed in revision 2 of this file: approval wording, BR-02 × BR-05 interaction, test references).
Baseline: accepted Sprint 1 `v0.1.0-sprint1` (`569f4f9`), accepted Lab 6 release `8c8fc20`; pre-change
implementation: `staging` `41e73c1` (BR-05 code unchanged since `v0.1.0-sprint1`).

## 1. Impact table

| Item | Affected? | Where | What changes / why not |
| :--- | :--- | :--- | :--- |
| Requirement | Yes | SRS §5 BR-05 (v1.3) | 2 h → 24 h, exactly 24 h allowed. FR-10 (cancel own booking) unchanged. |
| Feature | Yes | F-05 My bookings and cancellation (contract 1.2) | §1 steps 3–4, §2 rule function, §4 UI hint, AC-25/26/27, §7 boundaries. |
| System-Level SDS | No change | `docs/system-sds.md` error catalogue | Same error code `CANCELLATION_WINDOW_CLOSED` and status 409; layering unchanged. |
| Acceptance criteria | Yes | AC-25, AC-26, AC-27 | New boundary values and message. AC-23/24 unchanged. |
| STS | Yes | UNIT-05, API-22, API-23, UI-04 (STS 1.6) | Old 2 h expected results replaced by 24 h ones; E2E-05 unchanged (it cancels a booking at today+10). |
| Rule module | Yes | `server/src/rules/bookingRules.ts` | `CANCEL_WINDOW_MIN` 120 → 1440; message text. `canCustomerCancel` logic (BR-13 before BR-05, `>=`) unchanged. |
| Service / transaction | No change | `server/src/services/bookingService.ts` `cancelBooking` | Calls the rule inside the same locked transaction; nothing else to change. |
| API / validation | No change in shape | `POST /api/bookings/:reference/cancel` | Same request/response/errors; only the boundary and message differ. |
| Roles / ownership | No change | `requireRole('CUSTOMER')`, lookup by `customerId` | Must stay: other customer 404 (API-21), Staff 403 (API-07), anonymous 401 (API-06), server-side identity (API-08). |
| Client UI | Yes | `client/src/api/bookings.ts` `canCancel`, `client/src/pages/BookingDetailPage.tsx` hint | Comfort check 120 → 1440 min and hint text; the server still decides. |
| Persistence / schema | No change | Prisma schema | No new column; `cancelledAt`/`cancelledById` unchanged. No migration. |
| Historical data | No migration | existing BOOKED rows | Rule evaluated at cancellation time: bookings made under the old rule follow the 24 h cutoff from the release. Past CANCELLED rows untouched. |
| Seed / demo / E2E | Text + timing | `e2e/demo-evidence.spec.ts` (SHOT-01), `e2e/db.ts` comment | Shot 11 (booking at +75–90 min) was already inside the old window and stays uncancellable; only the hint text changes. Shot 12 cancels the booking of shot 05 (tomorrow 14:00): it is ≥ 24 h ahead only when SHOT-01 runs before 14:00 Bangkok, so the demo run becomes time-of-day dependent. SHOT-01 is excluded from CI. Resolved in PR #47 after review: the demo booking is made two days ahead (D+2), and SHOT-01 was run once locally. E2E-05 cancels a booking at today+10 and is unaffected. |
| Interaction BR-02 × BR-05 | Yes (intended) | F-04 booking + F-05 cancel | Bookings can be made ≥ 60 min ahead but cancelled only ≥ 24 h ahead, so a booking made less than 24 h before its start can never be cancelled by the Customer. This is intended by CR-01 (a late booking is a firm commitment). Not covered by a new booking-dialog warning in this change; recorded as a follow-up for Sprint 3 (show "cannot be cancelled" in the confirmation dialog when the slot starts in < 24 h). |
| Lab 6 UAT pack | Yes (document) | UAT-06 and UAT-08 cancel-window steps | Updated in UAT pack v1.2 (`docs/labs/lab-07/uat-pack-v1.2.pdf`): 24 h texts, test day D+2 so the UAT-06 cancellation stays ≥ 24 h ahead. |

## 2. Behaviour that must stay unchanged and its regression protection

| Unchanged behaviour | Protected by |
| :--- | :--- |
| BR-13 checked before BR-05 (CANCELLED/COMPLETED/NO_SHOW → 409 BOOKING_NOT_ACTIVE) | UNIT-05, API-23 |
| Ownership: another customer's booking → 404, no data, unchanged | API-21 (AC-24) |
| Anonymous → 401 on every protected route; Staff (wrong role) → 403 on customer booking routes | API-06 (AC-06), API-07 (AC-07); UI redirects E2E-02 |
| Identity and owner taken from the session, never from the body (BR-08) | API-08 (AC-08) |
| Cancelled slot is bookable again (BR-11) | API-22, E2E-05 |
| Booking rules BR-01..BR-04 unaffected | UNIT-03, UNIT-04, API-15..API-19 |
| Persistence across reload / re-login | E2E-05 |

Regression suite to run on the change: full server suite (`cd server && npx vitest run`), client suite
(`cd client && npx vitest run`), and Playwright E2E without SHOT-01, on the pre-change commit (red) and on the
change commit (green).
