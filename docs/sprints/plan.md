# SlotBook — Three-Sprint Plan

| Sprint | Dates | Checkpoint | Goal |
| :--- | :--- | :--- | :--- |
| 1 | 3 Nov – 8 Nov 2026 | Deliverable 1, 8 Nov 23:59 | Small working domain slice: authentication, two roles, staff publishes slots, customer books / views / cancels, staff sees the day — persisted and access-controlled. |
| 2 | 9 Nov – 29 Nov 2026 | Deliverable 2, 29 Nov | Core expansion: slot maintenance, reschedule, attendance, history, services, search; Docker + CI/CD + GCP (Lab 5). |
| 3 | 30 Nov – 13 Dec 2026 | Progress 29 Nov, complete 13 Dec | Remaining features (templates, dashboard, notifications, accounts, no-show policy) and product hardening. |

## Sprint 1 — Working booking slice

- **Features:** F-00, F-01, F-02, F-03, F-04, F-05, F-06.
- **Requirements:** FR-01..FR-11; BR-01..BR-13; NFR-01..NFR-10, NFR-13 (NFR-12 designed only).
- **Dependencies:** F-00 → F-01 → F-02 → F-03 → F-04 → {F-05, F-06}. Yanis builds the chain up to F-03
  (contracts, foundation, auth, access, slots); Simeon continues with F-04..F-06 and the release, using
  the auth/access layer and the seeded slots. Each PR is reviewed by the other student.
- **Completion outcome:** a reviewed release `v0.1.0-sprint1` on `main` where a Customer logs in, books a
  staff slot, sees the booking after reload, cancels it within the window, and is rejected by the rules
  (double booking, limit, overlap, late cancel); a Staff member creates slots and sees the day's
  bookings; every role/ownership restriction is enforced and tested by the API; all Sprint 1 AC have
  passing automated tests.
- **Why this scope:** it is the smallest slice that crosses UI → API → database with a meaningful
  transaction (booking an exclusive slot) and real rules, comparable to the theme example ("a customer
  cannot create a second active booking for an occupied exclusive slot"). Slot editing, attendance and
  services are left to Sprint 2 because Sprint 1 can run on seeded services and staff-created slots.

## Sprint 2 — Core expansion under engineering contracts

- **Features:** F-07 slot maintenance, F-08 reschedule, F-09 attendance, F-10 booking history,
  F-11 service catalogue, F-12 slot search, F-13 deployment pipeline.
- **Requirements:** FR-12..FR-18; BR-14..BR-17; NFR-11, NFR-12 (verified).
- **Dependencies:** F-07 needs F-03/F-05; F-08 needs F-04/F-05 and reuses the booking rules inside one
  transaction; F-10 must land before F-08/F-09 write history (history table introduced first);
  F-13 needs only F-00 and is done in Lab 5.
- **Completion outcome:** Deliverable 2 release on `main`, deployed on Cloud Run with Cloud SQL, CI green;
  staff can manage their day completely (close/cancel, outcomes) and customers can reschedule; every
  booking change has history.

## Sprint 3 — Remaining features and hardening

- **Features:** F-14 availability templates, F-15 staff dashboard, F-16 in-app notifications,
  F-17 accounts + no-show policy, F-18 product hardening.
- **Requirements:** FR-19..FR-22; BR-18, BR-19; NFR-08, NFR-09 (full audit), NFR-11 (re-check), NFR-13.
- **Dependencies:** F-14 needs F-07 (slot rules reused); F-15 needs F-09 outcomes; F-16 needs F-07/F-10
  events; F-17 needs F-09; F-18 last.
- **Completion outcome:** complete product baseline (FR-01..FR-22, BR-01..BR-19, NFR-01..NFR-13) released
  and deployed by 13 Dec, regression suite green, demonstration video recorded.

## Coverage Check

Every FR, BR and NFR of `srs.md` is allocated to exactly one establishing sprint in `traceability.md`;
no requirement is unallocated.
