## Change request CR-01 (Lab 7, maintenance): BR-05 cancellation cutoff 2 h → 24 h

**Type:** change to behaviour already delivered and accepted in Sprint 1 (not a defect: the current behaviour matches the current specification).

### Baseline
- Accepted Sprint 1 baseline: tag `v0.1.0-sprint1` = `569f4f9`; accepted Sprint 1 release tested in Lab 6: `main` `8c8fc20` (revision `slotbook-00007-4j9`), UAT decision Accepted (Group Paris, 19/11/2026).
- Actual pre-change implementation to modify: `staging` `41e73c1` (= Sprint 1 + Lab 5 + Lab 6 #43 fix; BR-05 code unchanged since `v0.1.0-sprint1`).

### Old requirement (SRS BR-05, F-05, AC-25/26/27)
> **Cancellation window.** A Customer can cancel an active booking only until **2 hours** before its start. → 409 `CANCELLATION_WINDOW_CLOSED` "Cancellation closes 2 hours before the start."

Implemented in `server/src/rules/bookingRules.ts` (`CANCEL_WINDOW_MIN = 120`, `canCustomerCancel`, exactly 120 min allowed) and mirrored in `client/src/api/bookings.ts` (`canCancel`) and `BookingDetailPage.tsx`.

### New requirement (BR-05 v2)
> **Cancellation window.** A Customer can cancel an active booking only until **24 hours** before its start. → 409 `CANCELLATION_WINDOW_CLOSED` "Cancellation closes 24 hours before the start."

**Reason:** staff need a full working day to offer a freed slot to someone else; with a 2-hour cutoff, slots cancelled late in the day stay empty. The product owner (team decision for Lab 7) moves the cutoff to the day before.

### Boundaries and invalid cases
| Time from now to the slot start | Old result | New result |
|---|---|---|
| ≥ 24 h 00 min (exactly 1440 min included) | 200 CANCELLED | 200 CANCELLED (unchanged) |
| 23 h 59 min (1439 min) | 200 CANCELLED | **409 CANCELLATION_WINDOW_CLOSED** |
| 3 h (180 min) | 200 CANCELLED | **409 CANCELLATION_WINDOW_CLOSED** |
| exactly 2 h (120 min) | 200 CANCELLED | **409 CANCELLATION_WINDOW_CLOSED** |
| 119 min / already started | 409 | 409 (unchanged) |
| booking CANCELLED / COMPLETED / NO_SHOW | 409 BOOKING_NOT_ACTIVE | 409 BOOKING_NOT_ACTIVE (BR-13 still checked first) |

### Scope and access (unchanged)
- Only the owning Customer can cancel (BR-08, BR-09): another Customer → 404, Staff → 403, anonymous → 401. No new role gets the right to cancel; staff-side cancellation stays in F-07 (Sprint 2).
- Existing bookings: no data migration. The rule is evaluated at cancellation time, so bookings made under the old rule follow the new cutoff from the release on.
- A cancelled slot is still freed (BR-11) and subject to BR-02.

### Acceptance criteria (revised)
- **AC-25 v2** Cancelling an own BOOKED booking that starts in ≥ 24 h → 200 CANCELLED with `cancelledAt`; the slot is bookable again by another customer.
- **AC-26 v2** Cancelling less than 24 h before the start (1439 min, 3 h, exactly 2 h) → 409 `CANCELLATION_WINDOW_CLOSED` with the new message; CANCELLED/COMPLETED/NO_SHOW → 409 `BOOKING_NOT_ACTIVE`; booking unchanged in both cases.
- **AC-27 v2** UI: the Cancel button is not offered inside the 24-hour window and the hint says "Cancellation closes 24 hours before the start."

### Approval
Requested from the TAs and instructors by e-mail on 25/11/2026 at 11:09 (Bangkok). **Approved to proceed** by TA Kantapat Suwannahong (Bump), e-mail of 25/11/2026 11:48: “For Lab 7, you do not need to have the instructor or TAs check or approve your work. You can proceed directly.” Recorded on Issue #45 before the implementation commits (ee5ccea, d6491a7). Contract reviewed and approved by Simeon Audouit in PR #46 (25/11/2026 11:17, review points answered in 3470dd7) before implementation.
