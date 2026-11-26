# Sprint 3 — Engineering Contracts and Plan of the Remaining Work

Sprint 3 runs 30 Nov – 13 Dec 2026 (final release and demonstration on 13 Dec). Its contracts and STS are
merged before any Sprint 3 code (Issue #57). **F-15 (staff dashboard) is implemented early, in Deliverable 2**,
as the Sprint 3 workflow required by Part C; the other features follow the plan below.

| Item | File |
| :--- | :--- |
| F-14 Availability templates | [F-14-availability-templates.md](F-14-availability-templates.md) |
| F-15 Staff dashboard | [F-15-staff-dashboard.md](F-15-staff-dashboard.md) |
| F-16 In-app notifications | [F-16-notifications.md](F-16-notifications.md) |
| F-17 Accounts and no-show policy | [F-17-accounts-no-show.md](F-17-accounts-no-show.md) |
| F-18 Product hardening | [F-18-hardening.md](F-18-hardening.md) |
| Software Test Specification | [sts.md](sts.md) |

The product Definition of Done (`../sprint-1/dod.md`) and the Sprint 2 additions (`../sprint-2/dod.md`, items
12–15) apply unchanged; the Sprint 3 release tag is `v1.0.0`.

## Issues, Owners and Order

| Order | Issue | Scope | Branch | Author | Reviewer | Target date |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | #57 | Sprint 3 contracts and STS | `docs/sprint3-contracts` | Yanis | Simeon | 25 Nov (done before #58) |
| 1 | #58 | F-15 Staff dashboard (**in Deliverable 2**) | `feature/58-staff-dashboard` | Yanis | Simeon | 28 Nov |
| 2 | #61 | F-17 Accounts and no-show policy | `feature/61-accounts-no-show` | Simeon | Yanis | 3 Dec |
| 3 | #59 | F-14 Availability templates | `feature/59-templates` | Simeon | Yanis | 6 Dec |
| 4 | #60 | F-16 In-app notifications (needs F-17 for the deactivation case) | `feature/60-notifications` | Yanis | Simeon | 6 Dec |
| 5 | #62 | F-18 Hardening: axe audit, responsive, PERF re-check, release-check script | `feature/62-hardening` | Both | Both | 10 Dec |
| 6 | #63 | Final release `v1.0.0`: regression, traceability, deploy, demo video | `release/v1.0.0` | Yanis | Simeon | 12 Dec |

## Risks and Mitigations

| Risk | Mitigation |
| :--- | :--- |
| F-16 depends on F-17 (deactivation notifications) | F-17 first; F-16 can ship the F-07/F-09 cases if F-17 slips, and the gap is written in the release notes. |
| Schema changes on the deployed database (templates, notifications, index) | Additive migrations only; each is run by the migration job of `deploy.yml` on staging data first (DoD 13). |
| Two-person team and 2 weeks | Every feature keeps the contract → RED → GREEN → review flow; F-18 is time-boxed to 2 days; anything not done by 12 Dec is disclosed, not hidden. |

## AC and Test Numbering

AC-69 … AC-87; UNIT-15..18, API-50..57, UI-12..15, E2E-16..21, PERF-02, MAN-03.

## Contract Version History

| Version | Date | File(s) | Author | Change and reason |
| :--- | :--- | :--- | :--- | :--- |
| 3.0 | 2026-11-25 | all Sprint 3 files; ../../traceability.md | Yanis Amrane | Initial Sprint 3 contracts and STS, recorded before any Sprint 3 code (Issue #57). Reviewed by Simeon Audouit. |
| 3.1 | 2026-11-26 | F-17-accounts-no-show.md 1.1 | Simeon Audouit | `activeBookingRefs` and the 409 date format (Issue #61). |
| 3.2 | 2026-11-26 | F-18-hardening.md 1.1; sts.md 1.1 | Yanis Amrane | PERF-02 deployed part is read-only (search and one-day availability); the booking latency is measured on the release candidate by PERF-01 (Issue #62). The STS lists the earlier tests changed. Reviewed by Simeon Audouit in the #62 and release PRs. |

## Outcome (2026-11-26)

All Sprint 3 Issues were implemented ahead of the plan dates above, in the planned order, and merged into
`staging`: #61 → PR #77, #59 → PR #78, #60 → PR #79, #62 → PR #80 (merge `4131d77`). Results: `sts.md` (Result
column) and `../../traceability.md` §6. Remaining for #63: release PR to `main`, tag `v1.0.0`, deploy, deployed
PERF-02, durability check after a restart and a redeploy, independent UAT re-test.
