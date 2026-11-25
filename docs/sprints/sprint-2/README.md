# Sprint 2 — Engineering Contracts

Sprint 2 runs 16 Nov – 29 Nov 2026 (Deliverable 2 checkpoint 29 Nov 23:59). These contracts, the STS and the
DoD are merged into `staging` **before** any Sprint 2 implementation commit (Issue #49). F-13 (deployment
pipeline) was delivered in Lab 5 and is not repeated here.

| Item | File |
| :--- | :--- |
| F-07 Slot maintenance | [F-07-slot-maintenance.md](F-07-slot-maintenance.md) |
| F-08 Reschedule a booking | [F-08-reschedule.md](F-08-reschedule.md) |
| F-09 Attendance outcome | [F-09-attendance.md](F-09-attendance.md) |
| F-10 Booking history | [F-10-booking-history.md](F-10-booking-history.md) |
| F-11 Service catalogue | [F-11-service-catalogue.md](F-11-service-catalogue.md) |
| F-12 Slot search (+ NFR-11) | [F-12-slot-search.md](F-12-slot-search.md) |
| Software Test Specification | [sts.md](sts.md) |
| Sprint 2 Definition of Done | [dod.md](dod.md) |

## Issues, Branches, Owners and Order

Implementation order follows the dependencies: F-10 first (history table used by F-07, F-08, F-09), then F-11
(A-04 change to BR-04 before more booking code), then the rest.

| Order | Issue | Scope | Branch | Author | Reviewer |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | #49 | Sprint 2 contracts, STS, DoD; SRS 1.4, SDS 1.5, traceability | `docs/sprint2-contracts` | Yanis | Simeon |
| 1 | #50 | F-10 Booking history | `feature/50-booking-history` | Yanis | Simeon |
| 2 | #51 | F-11 Service catalogue (+ A-04) | `feature/51-service-catalogue` | Yanis | Simeon |
| 3 | #52 | F-07 Slot maintenance | `feature/52-slot-maintenance` | Simeon | Yanis |
| 4 | #53 | F-09 Attendance outcome | `feature/53-attendance` | Simeon | Yanis |
| 5 | #54 | F-08 Reschedule | `feature/54-reschedule` | Yanis | Simeon |
| 6 | #55 | F-12 Slot search + NFR-11 performance test | `feature/55-slot-search` | Simeon | Yanis |
| 7 | #56 | Sprint 2 release: regression, AC-68, traceability, release PR to `main`, deployment checks | `release/sprint-2` | Yanis | Simeon |

Branch flow: `main` ← `staging` ← `feature/<issue>-<slug>`. Both protected branches need one approval by the
teammate and the green check `test-and-docker` (Lab 5 rulesets).

## Cross-Cutting Sprint 2 Acceptance (verified in Issue #56)

| AC | Criterion |
| :--- | :--- |
| AC-68 | The new or changed Sprint 2 screens (`/staff/services`, `/staff/slots` actions, `/staff/bookings/:reference`, `/bookings/:reference` history, `/bookings/:reference/reschedule`, `/search`) have no horizontal page scroll and no clipped control at 320, 768 and 1280 px; every new dialog traps focus, closes with Esc and returns focus; every action can be done with the keyboard only (NFR-08, NFR-09). |

## AC and Test Numbering

AC-40 … AC-68 (Sprint 1 ended at AC-39). Tests continue the Sprint 1 series: UNIT-09..14, API-29..49,
DB-05..07, UI-06..11, E2E-09..15, plus PERF-01.

| Feature | AC |
| :--- | :--- |
| F-10 | AC-40 – AC-43 |
| F-11 | AC-44 – AC-48 |
| F-07 | AC-49 – AC-54 |
| F-09 | AC-55 – AC-58 |
| F-08 | AC-59 – AC-63 |
| F-12 | AC-64 – AC-67 |
| Cross-cutting | AC-68 |

## Contract Version History

Same rule as Sprint 1: a change after this PR is merged is made in the PR that needs it, with a row here,
the file's own history row and a sentence in the PR body.

| Version | Date | File(s) | Author | Change and reason |
| :--- | :--- | :--- | :--- | :--- |
| 2.0 | 2026-11-25 | all Sprint 2 files; ../../srs.md 1.4; ../../system-sds.md 1.5; ../../traceability.md; ../plan.md | Yanis Amrane | Initial Sprint 2 contracts, STS and DoD, recorded before any Sprint 2 implementation (Issue #49). Reviewed by Simeon Audouit, who implements F-07, F-09 and F-12. |
