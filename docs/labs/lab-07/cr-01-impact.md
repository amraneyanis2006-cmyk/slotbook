# CR-01 — Impact analysis (BR-05 cancellation cutoff 2 h → 24 h)

Prepared 2026-11-25 by Yanis Amrane, before implementation; reviewed by Simeon Audouit in the contract PR.
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
| Roles / ownership | No change | `requireRole('CUSTOMER')`, lookup by `customerId` | Must stay: other customer 404, Staff 403, anonymous 401 (API-21, API-24, API-08). |
| Client UI | Yes | `client/src/api/bookings.ts` `canCancel`, `client/src/pages/BookingDetailPage.tsx` hint | Comfort check 120 → 1440 min and hint text; the server still decides. |
| Persistence / schema | No change | Prisma schema | No new column; `cancelledAt`/`cancelledById` unchanged. No migration. |
| Historical data | No migration | existing BOOKED rows | Rule evaluated at cancellation time: bookings made under the old rule follow the 24 h cutoff from the release. Past CANCELLED rows untouched. |
| Seed / demo / E2E | Text only | `e2e/demo-evidence.spec.ts` shot 11 text, `e2e/db.ts` comment | The demo booking at +75–90 min stays inside the window; only the visible hint text changes. SHOT-01 is excluded from CI. |
| Lab 6 UAT pack | Yes (document) | UAT-06 and UAT-08 cancel-window steps | To update for the final UAT re-run (24 h instead of 2 h). |

## 2. Behaviour that must stay unchanged and its regression protection

| Unchanged behaviour | Protected by |
| :--- | :--- |
| BR-13 checked before BR-05 (CANCELLED/COMPLETED/NO_SHOW → 409 BOOKING_NOT_ACTIVE) | UNIT-05, API-23 |
| Ownership: another customer's booking → 404, no data, unchanged | API-21, API-24 |
| Staff → 403, anonymous → 401 on booking endpoints | API-08, E2E-02 |
| Cancelled slot is bookable again (BR-11) | API-22, E2E-05 |
| Booking rules BR-01..BR-04 unaffected | UNIT-03, UNIT-04, API-15..API-19 |
| Persistence across reload / re-login | E2E-05 |

Regression suite to run on the change: full server suite (`cd server && npx vitest run`), client suite
(`cd client && npx vitest run`), and Playwright E2E without SHOT-01, on the pre-change commit (red) and on the
change commit (green).
