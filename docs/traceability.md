# SlotBook — Requirements Traceability

Requirement → feature or system responsibility → sprint that establishes it → verification.
Sprint 1 rows name the AC and test IDs (see `sprints/sprint-1/sts.md`); later-sprint rows are allocated
now and receive AC/tests in their own sprint contracts.

## 1. Functional Requirements

| Requirement | Feature / responsibility | Sprint and verification |
| :--- | :--- | :--- |
| FR-01 Log in | F-01 Authentication | Sprint 1; AC-01, AC-02, AC-05 / API-01, API-02, API-03, UI-01, E2E-01 |
| FR-02 Log out | F-01 Authentication | Sprint 1; AC-04 / API-05, E2E-01 |
| FR-03 Current user | F-01 Authentication | Sprint 1; AC-03 / API-04 |
| FR-04 Role landing and navigation | F-01 + F-02 | Sprint 1; AC-05, AC-10 / UI-01, E2E-01, E2E-02 |
| FR-05 Staff creates slot | F-03 Staff slots | Sprint 1; AC-11, AC-12, AC-15 / UNIT-01, API-10, API-11, UI-02, E2E-03 |
| FR-06 Staff lists own slots | F-03 Staff slots | Sprint 1; AC-14 / API-13 |
| FR-07 Customer lists bookable slots | F-04 Book a slot | Sprint 1; AC-16 / API-14 |
| FR-08 Customer books | F-04 Book a slot | Sprint 1; AC-17, AC-22 / UNIT-03, API-15, UI-03, E2E-04 |
| FR-09 My bookings | F-05 My bookings | Sprint 1; AC-23, AC-27 / API-20, UI-04, E2E-05 |
| FR-10 Cancel own booking | F-05 My bookings | Sprint 1; AC-25, AC-26 / UNIT-05, API-22, API-23, E2E-05 |
| FR-11 Staff daily schedule | F-06 Schedule | Sprint 1; AC-28, AC-29 / API-24, E2E-06 |
| FR-12 Edit / close slot | F-07 Slot maintenance | Sprint 2 (contract 2.0, Issue #49); AC-49, AC-50, AC-53, AC-54 / UNIT-11, API-35, API-36, API-39, UI-08, E2E-11 |
| FR-13 Cancel booked slot with reason | F-07 Slot maintenance (+ F-10 reason display) | Sprint 2 (contract 2.0, Issue #49); AC-52, AC-54 / API-38, UI-06, UI-08, E2E-11 |
| FR-14 Reschedule | F-08 Reschedule | Sprint 2 (contract 2.0, Issue #49); AC-59, AC-62, AC-63 / UNIT-13, API-43, API-46, UI-10, E2E-13 |
| FR-15 Attendance outcome | F-09 Attendance | Sprint 2 (contract 2.0, Issue #49); AC-55, AC-57, AC-58 / UNIT-12, API-40, API-42, UI-09, E2E-12 |
| FR-16 Booking history | F-10 History | Sprint 2 (contract 2.0, Issue #49); AC-40, AC-41, AC-43 / UNIT-09, API-29, API-30, UI-06, E2E-09 |
| FR-17 Service catalogue | F-11 Services | Sprint 2 (contract 2.0, Issue #49); AC-44, AC-45, AC-46, AC-48 / UNIT-10, API-31, API-32, API-33, DB-07, UI-07, E2E-10 |
| FR-18 Slot search | F-12 Search | Sprint 2 (contract 2.0, Issue #49); AC-64, AC-65, AC-67 / UNIT-14, API-47, API-48, API-49, UI-11, E2E-14 |
| FR-19 Availability templates | F-14 Templates | Sprint 3 (contract 3.0, Issue #57); AC-72..AC-75 / UNIT-16, API-51, API-52, UI-13, E2E-17 (passed, PR #78) |
| FR-20 Staff dashboard | F-15 Dashboard | Sprint 3 (contract 3.0, Issue #57); AC-69..AC-71 / UNIT-15, API-50, UI-12, E2E-16 (implemented in Deliverable 2, #58) |
| FR-21 In-app notifications | F-16 Notifications | Sprint 3 (contract 3.0, Issue #57); AC-76..AC-78 / UNIT-17, API-53, API-54, UI-14, E2E-18 (passed, PR #79) |
| FR-22 Account overview / deactivate | F-17 Accounts | Sprint 3 (contract 3.0, Issue #57); AC-81..AC-83 / API-56, API-57, UI-15, E2E-19 (passed, PR #77) |

## 2. Business Rules

| Requirement | Feature / responsibility | Sprint and verification |
| :--- | :--- | :--- |
| BR-01 Exclusive slot | F-04 (service check + DB partial unique index) | Sprint 1; AC-18, AC-19 / API-16, API-17, DB-01 |
| BR-02 Bookable only ≥ 60 min ahead | F-04 | Sprint 1; AC-20 / UNIT-04, API-18 |
| BR-03 Max 3 active bookings | F-04 | Sprint 1; AC-21 / UNIT-04, API-19 |
| BR-04 No overlapping own bookings | F-04; query changed by F-11 (A-04 resolved) | Sprint 1; AC-21 / UNIT-04, API-19; Sprint 2: AC-47 / API-34 |
| BR-05 Cancellation window 24 h (v2, CR-01 Lab 7; 2 h in Sprint 1) | F-05 | Sprint 1, changed by CR-01; AC-25, AC-26, AC-27 / UNIT-05, API-22, API-23, UI-04 |
| BR-06 Valid slot (future, 15 min, opening hours, active service) | F-03 | Sprint 1; AC-12 / UNIT-01, API-11 |
| BR-07 No overlapping staff slots | F-03 | Sprint 1; AC-13 / UNIT-02, API-12 |
| BR-08 Server-side identity | F-02 (system responsibility, re-checked in F-03/F-04) | Sprint 1; AC-08 / API-08 |
| BR-09 Ownership (404) | F-02 + F-03..F-06 | Sprint 1; AC-14, AC-24, AC-28 / API-13, API-21, API-24 |
| BR-10 Booking reference | F-04 + F-00 sequence | Sprint 1; AC-17 / UNIT-03, API-15 |
| BR-11 Freed slot after cancel | F-05 | Sprint 1; AC-25 / API-22, E2E-05 |
| BR-12 Inactive accounts | F-01 | Sprint 1; AC-02 / API-03 |
| BR-13 Only active bookings change | F-05 | Sprint 1; AC-26 / UNIT-05, API-23 |
| BR-14 Booked slot only cancellable | F-07 | Sprint 2 (contract 2.0, Issue #49); AC-51, AC-52 / UNIT-11, API-37, API-38 |
| BR-15 Outcome after start | F-09 | Sprint 2 (contract 2.0, Issue #49); AC-55, AC-56 / UNIT-12, API-40, API-41 |
| BR-16 Atomic reschedule | F-08 | Sprint 2 (contract 2.0, Issue #49); AC-60, AC-61 / API-44, API-45 |
| BR-17 Append-only history | F-10 (+ writers F-04, F-05, F-07, F-08, F-09) | Sprint 2 (contract 2.0, Issue #49); AC-40, AC-42 / UNIT-09, API-29, DB-05, DB-06; history rows also asserted in API-38, API-40, API-43 |
| BR-18 Template generation skips | F-14 | Sprint 3 (contract 3.0, Issue #57); AC-72, AC-73 / UNIT-16, API-51 (passed, PR #78) |
| BR-19 No-show suspension | F-17 | Sprint 3 (contract 3.0, Issue #57); AC-79, AC-80 / UNIT-18, API-55 (passed, PR #77) |

## 3. Non-Functional Requirements

| Requirement | Feature / responsibility | Sprint and verification |
| :--- | :--- | :--- |
| NFR-01 Authentication required | F-02 `requireAuth` (every later endpoint joins the access table) | Established Sprint 1; AC-06 / API-06; re-verified every sprint |
| NFR-02 Backend authorization | F-02 `requireRole` + service ownership | Established Sprint 1; AC-07, AC-24, AC-28 / API-07, API-21, API-24 |
| NFR-03 Password hashing | F-01 + F-00 seed | Sprint 1; AC-01, AC-32 / API-01, DB-02 |
| NFR-04 Concurrency safety | F-04 + F-00 partial index | Sprint 1; AC-19 / API-17, DB-01 |
| NFR-05 Session lifetime / logout | F-01 | Sprint 1; AC-01, AC-04 / API-01, API-05, UNIT-06 |
| NFR-06 Safe errors | F-02 error handler | Sprint 1; AC-09 / API-09 |
| NFR-07 Reproducible setup, idempotent seed | F-00 | Sprint 1; AC-32 / DB-02 + MAN-02 clean-clone check at release |
| NFR-08 Responsive UI | F-03..F-06, F-07..F-12 screens; F-18 later | Sprint 1 for S1 screens; AC-30 / E2E-07; Sprint 2 screens AC-68 / E2E-15; Sprint 3 screens AC-85 / E2E-21 (PR #80) |
| NFR-09 Accessibility baseline | F-01..F-12 screens; F-18 full audit | Sprint 1 baseline; AC-30, AC-05, AC-15, AC-22, AC-27 / E2E-08, UI-01, UI-02, UI-03, UI-04; Sprint 2 AC-68 / E2E-15; Sprint 3 axe-core audit of every route AC-84 / E2E-20 and keyboard AC-85 / E2E-21 (PR #80) |
| NFR-10 Time correctness (UTC / Bangkok) | F-00 time helpers, F-03..F-05 rules | Sprint 1; AC-12, AC-20, AC-26 / UNIT-01, UNIT-04, UNIT-05 |
| NFR-11 Performance p95 < 500 ms | F-12 Search (+ F-18 re-check) | Sprint 2 (contract 2.0, Issue #49); AC-66 / PERF-01 (`npm run test:perf`, timings in `artifacts/sprint-2/perf/`); F-18 re-check AC-86 / PERF-02 (`artifacts/sprint-3/perf/`) |
| NFR-12 Deployability (env, stateless, Docker, GCP) | Designed in SDS §7 (Sprint 1); F-00 1.2 cloud-ready server (Lab 5 #20); F-13 pipeline | Design Sprint 1 (health check AC-31 / API-25); Lab 5 #20: AC-33 / API-26 (`/api/ready`), AC-34 / API-27 (SPA in production, Secure cookie behind proxy), AC-35 / UNIT-07 (startup refusal), AC-36 / DB-03 (production seed opt-in), AC-37 / DB-04 (production seed rerun is insert-only); Lab 5 #19: GCP project `cpe334-slotbook-y`, alerts-only budget, teammate access (Console, `artifacts/lab-05/screenshots/issue-19/`); Lab 5 #21: single Docker image + compose, AC-38 / UNIT-08 (graceful shutdown on SIGTERM), C-03 fresh-clone check (`artifacts/lab-05/c03-fresh-clone.txt`); Lab 5 #22: CI job `test-and-docker` on every PR into staging/main (C-01), offline deploy-script tests (`deploy/tests/`), C-01 run 43270720258 with `test-and-docker` and `e2e` green (`artifacts/lab-05/test-output/ci-c01/`); Lab 5 #23: first deployment to Cloud Run (`deploy/deploy.sh --demo` from Cloud Shell, revision `slotbook-00001-jcd`, smoke test 4 PASS; `artifacts/lab-05/deploy/`); Lab 5 #24: keyless GitHub → GCP identity (Workload Identity pool `github-actions`, deployer `slotbook-deployer`, environment `demo` on `main` only, `artifacts/lab-05/deploy/wif-setup.txt`) and merge gate R-06 (rulesets `protect-main` / `protect-staging`, required check `test-and-docker`), C-02 PR #35 blocked by the failing required check (`artifacts/lab-05/merge-gate.md`); Lab 5 #25: deploy pipeline `deploy.yml` (R-07) and running commit (R-08) AC-39 / API-28, UI-05 (`/api/version`, release footer), `deploy/tests/test_release_stub.sh` (`APP_COMMIT`, `latest` rollback only); C-06 Release 2 PR #38, merge `82bc8b7`, Deploy run 43571888289, revision `slotbook-00002-fmw` (`artifacts/lab-05/c06-release.txt`); Lab 5 #26: C-05 persistence check (R-04): booking kept through a restart, a redeploy, a rollback to `latest` and a roll forward (runs 43579388131, 43579900715, 43580291684; `artifacts/lab-05/c05-persistence.md`); Docker, CI and GCP verified in the later Lab 5 Issues |
| NFR-13 Test discipline / traceability | Release check of every sprint (Issue #8 in Sprint 1) | Every sprint; AC-87 / MAN-03 `scripts/release-check.sh`, a CI step since PR #80 |

## 4. Coverage Gaps and Approved Changes

- **Uncovered requirements:** none. Every FR (22), BR (19) and NFR (13) above has a feature or system
  responsibility and an establishing sprint.
- **Sprint 1 requirements without automated test:** none. Manual checks MAN-01/MAN-02 only supplement.
- **Approved changes:** 1.1 (2026-11-07) — 18 fixes from the pre-PR contract review, decided by Yanis Amrane,
  reviewed in PR #9 (Issue #1); list in `sprints/sprint-1/README.md` version history and the PR body. Later
  changes are added here with date, reason, approver and the PR that made them.
- **1.2 (2026-11-10), F-06 §2 summary:** `closed` counts CLOSED slots without a booking, so a slot is never
  counted twice. Made in PR #15 (Issue #7), accepted by Yanis Amrane.
- **1.3 (2026-11-10), Issue #8 decisions by Yanis Amrane:** SRS A-04; STS UNIT-04, UNIT-05, API-23, E2E-06 and §6
  wording; SDS §3.2 empty-state example and Node/PostgreSQL versions. Made in the Issue #8 PR. No requirement,
  AC or test ID was added or removed.
- **1.4 (2026-11-11), Lab 5 Issue #20 (NFR-12):** F-00 1.2 — the seed may run in production with
  `SEED_DEMO_DATA=true` (was: refuses production) and is then insert-only, demo slots only on an empty database; `/api/ready`, production SPA serving, trust proxy and startup
  refusal added as AC-33..AC-37 (SDS 1.3 §4/§7 follow) with UNIT-07, API-26, API-27, DB-03, DB-04. Reason: Lab 5 cloud deployment and Lab 6 UAT
  demo accounts. Made in the Issue #20 PR.
- **CR-01 (2026-11-25), Lab 7, Issue #45:** BR-05 cancellation cutoff 2 h → 24 h (SRS 1.3, F-05 1.2, STS 1.6:
  UNIT-05, API-22, API-23, UI-04). Approved per the TA's e-mail of 25 Nov; contract PR #46, implementation PR #47,
  release PR #48.
- **Sprint 2 contracts 2.0 (2026-11-25), Issue #49:** F-07..F-12, STS (AC-40..AC-68, UNIT-09..14, API-29..49,
  DB-05..07, UI-06..11, E2E-09..15, PERF-01), DoD; SRS 1.4 (A-04 resolved, A-05, A-06, D-07); SDS 1.5. Sprint 1 tests
  changed by Sprint 2 are listed in `sprints/sprint-2/sts.md` §7. Written by Yanis Amrane, reviewed by Simeon Audouit
  before any Sprint 2 implementation.
- **Sprint 3 contracts 3.0 (2026-11-25), Issue #57:** F-14..F-18 and STS (AC-69..AC-87); F-15 is implemented in
  Deliverable 2 (#58), the rest is planned in `sprints/sprint-3/README.md`. Written by Yanis Amrane, reviewed by
  Simeon Audouit.

## 5. Requirement Status at the Final Release

| Status | Requirements |
| :--- | :--- |
| Implemented and verified (tests run and passed together, §6) | FR-01..FR-22; BR-01..BR-19; NFR-01..NFR-06, NFR-08, NFR-09 (axe-core audit of every route, E2E-20), NFR-10, NFR-12, NFR-13 (MAN-03 release check, CI step) |
| Verified, one measure still to run | NFR-11: PERF-01 passed on the release candidate (p95 22.8 / 11.9 / 40.5 ms); the deployed part of PERF-02 runs after the v1.0.0 deploy (AC-86 INCOMPLETE until then) |
| Release-level checks | NFR-07: CI clean install, migrate and seed on every run; MAN-02 clean-clone check on the v1.0.0 commit |
| Not implemented | none (Q-03 answered by F-17: BR-19) |

No requirement is without an owning feature. No AC is without an executed test (§6); the only AC not yet PASS is
AC-86, whose deployed measure is listed above.

## 6. Final AC Verification Results Matrix (`4131d77`)

Generated from the STS Result columns (Sprint 1 1.6, Sprint 2 1.2, Sprint 3 1.1) and §1–§3: every AC with its
requirements, feature, sprint, test IDs, test files and result. Result values: PASS, FAIL, SKIPPED, INCOMPLETE (a
test whose run is not complete, e.g. a deployed measure still to run). "Verified at" is the commit and CI run on
which the whole suite passed together; "First passed in" is the PR (or release) where the test first passed.
A planned or skipped test is never counted as coverage; `scripts/release-check.sh` (MAN-03) checks that every AC
below has a test ID found in its files and that no test is skipped.

| AC | Requirements | Feature | Sprint | Tests | Files | Result | Verified at | First passed in |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| AC-01 | FR-01, NFR-03, NFR-05 | F-01 | 1 | UNIT-06, API-01 | `server/tests/unit/sessionConfig.test.ts`<br>`server/tests/api/auth.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-02 | FR-01, BR-12 | F-01 | 1 | API-02, API-03 | `server/tests/api/auth.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-03 | FR-03 | F-01 | 1 | API-04 | `server/tests/api/auth.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-04 | FR-02, NFR-05 | F-01 | 1 | API-05, E2E-01 | `server/tests/api/auth.api.test.ts`<br>`e2e/auth.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-05 | FR-01, FR-04, NFR-09 | F-01 | 1 | UI-01, E2E-01 | `client/tests/LoginPage.test.tsx`<br>`e2e/auth.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-06 | NFR-01 | F-02 | 1 | API-06 | `server/tests/api/access.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-07 | NFR-02 | F-02 | 1 | API-07 | `server/tests/api/access.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-08 | BR-08 | F-02 | 1 | API-08 | `server/tests/api/access.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-09 | NFR-06 | F-02 | 1 | API-09 | `server/tests/api/access.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-10 | FR-04 | F-03 | 1 | E2E-02 | `e2e/auth.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-11 | FR-05 | F-03 | 1 | API-10 | `server/tests/api/slots.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-12 | FR-05, BR-06, NFR-10 | F-03 | 1 | UNIT-01, API-11 | `server/tests/unit/slotRules.test.ts`<br>`server/tests/api/slots.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-13 | BR-07 | F-03 | 1 | UNIT-02, API-12 | `server/tests/unit/slotRules.test.ts`<br>`server/tests/api/slots.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-14 | FR-06, BR-09 | F-03 | 1 | API-13 | `server/tests/api/slots.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-15 | FR-05, NFR-09 | F-04 | 1 | UI-02, E2E-03 | `client/tests/MySlotsPage.test.tsx`<br>`e2e/staff-slots.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-16 | FR-07 | F-04 | 1 | API-14 | `server/tests/api/bookings.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-17 | FR-08, BR-10 | F-04 | 1 | UNIT-03, API-15, E2E-04 | `server/tests/unit/bookingRules.test.ts`<br>`server/tests/api/bookings.api.test.ts`<br>`e2e/booking-journey.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-18 | BR-01 | F-04 | 1 | API-16 | `server/tests/api/bookings.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-19 | BR-01, NFR-04 | F-04 | 1 | API-17, DB-01 | `server/tests/api/bookings.api.test.ts`<br>`server/tests/db/constraints.db.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-20 | BR-02, NFR-10 | F-04 | 1 | UNIT-04, API-18 | `server/tests/unit/bookingRules.test.ts`<br>`server/tests/api/bookings.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-21 | BR-03, BR-04 | F-04 | 1 | UNIT-04, API-19 | `server/tests/unit/bookingRules.test.ts`<br>`server/tests/api/bookings.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-22 | FR-08, NFR-09 | F-04 | 1 | UI-03, E2E-04 | `client/tests/BookSlotPage.test.tsx`<br>`e2e/booking-journey.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-23 | FR-09 | F-05 | 1 | API-20, E2E-05 | `server/tests/api/my-bookings.api.test.ts`<br>`e2e/booking-journey.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-24 | BR-09, NFR-02 | F-05 | 1 | API-21 | `server/tests/api/my-bookings.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-25 | FR-10, BR-05, BR-11 | F-05 | 1 | UNIT-05, API-22, E2E-05 | `server/tests/unit/bookingRules.test.ts`<br>`server/tests/api/my-bookings.api.test.ts`<br>`e2e/booking-journey.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | CR-01 d6491a7; Sprint 1 release e5af45c |
| AC-26 | FR-10, BR-05, BR-13, NFR-10 | F-05 | 1 | UNIT-05, API-23 | `server/tests/unit/bookingRules.test.ts`<br>`server/tests/api/my-bookings.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | CR-01 d6491a7 |
| AC-27 | FR-09, BR-05, NFR-09 | F-05 | 1 | UI-04, E2E-05 | `client/tests/MyBookingsPage.test.tsx`<br>`e2e/booking-journey.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | CR-01 d6491a7; Sprint 1 release e5af45c |
| AC-28 | FR-11, BR-09, NFR-02 | F-06 | 1 | API-24 | `server/tests/api/schedule.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-29 | FR-11 | F-06 | 1 | E2E-06 | `e2e/schedule.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-30 | NFR-08, NFR-09 | F-06 | 1 | E2E-07, E2E-08 | `e2e/responsive-a11y.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-31 | NFR-12 | F-00 | 1 | API-25 | `server/tests/api/health.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-32 | NFR-03, NFR-07 | F-00 | 1 | DB-02 | `server/tests/db/seed.db.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-33 | NFR-12 | F-13 | Lab 5 | API-26 | `server/tests/api/health.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Lab 5 |
| AC-34 | NFR-12 | F-13 | Lab 5 | API-27 | `server/tests/api/production.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Lab 5 |
| AC-35 | NFR-12 | F-13 | Lab 5 | UNIT-07 | `server/tests/unit/sessionConfig.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Lab 5 |
| AC-36 | NFR-12 | F-13 | Lab 5 | DB-03 | `server/tests/db/seed.db.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Lab 5 |
| AC-37 | NFR-12 | F-13 | Lab 5 | DB-04 | `server/tests/db/seed.db.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Lab 5 |
| AC-38 | NFR-12 | F-13 | Lab 5 | UNIT-08 | `server/tests/unit/sessionConfig.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Lab 5 |
| AC-39 | NFR-12 | F-13 | Lab 5 | API-28, UI-05 | `server/tests/api/health.api.test.ts`<br>`client/tests/ReleaseFooter.test.tsx` | PASS | staging `4131d77`, CI 45763486080 | Lab 5 |
| AC-40 | FR-16, BR-17 | F-10 | 2 | UNIT-09, API-29 | `server/tests/unit/historyRules.test.ts`<br>`server/tests/api/history.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #65 |
| AC-41 | FR-16 | F-10 | 2 | UNIT-09, API-30 | `server/tests/unit/historyRules.test.ts`<br>`server/tests/api/history.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #65 |
| AC-42 | BR-17 | F-10 | 2 | DB-05, DB-06 | `server/tests/db/history.db.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #65 |
| AC-43 | FR-16 | F-10 | 2 | UI-06, E2E-09 | `client/tests/BookingDetailPage.test.tsx`<br>`e2e/sprint2-history.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #65 |
| AC-44 | FR-17 | F-11 | 2 | API-31 | `server/tests/api/services.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #66 |
| AC-45 | FR-17 | F-11 | 2 | UNIT-10, API-32, DB-07 | `server/tests/unit/serviceRules.test.ts`<br>`server/tests/api/services.api.test.ts`<br>`server/tests/db/services.db.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #66 |
| AC-46 | FR-17 | F-11 | 2 | API-33 | `server/tests/api/services.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #66 |
| AC-47 | BR-04 | F-11 | 2 | API-34 | `server/tests/api/bookings.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #66 |
| AC-48 | FR-17 | F-11 | 2 | UI-07, E2E-10 | `client/tests/ServicesPage.test.tsx`<br>`e2e/sprint2-services.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #66 |
| AC-49 | FR-12 | F-07 | 2 | UNIT-11, API-35 | `server/tests/unit/slotRules.test.ts`<br>`server/tests/api/slotMaintenance.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #67 |
| AC-50 | FR-12 | F-07 | 2 | UNIT-11, API-36 | `server/tests/unit/slotRules.test.ts`<br>`server/tests/api/slotMaintenance.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #67 |
| AC-51 | BR-14 | F-07 | 2 | UNIT-11, API-37 | `server/tests/unit/slotRules.test.ts`<br>`server/tests/api/slotMaintenance.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #67 |
| AC-52 | FR-13, BR-14 | F-07 | 2 | UNIT-11, API-38 | `server/tests/unit/slotRules.test.ts`<br>`server/tests/api/slotMaintenance.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #67 |
| AC-53 | FR-12 | F-07 | 2 | UNIT-11, API-39 | `server/tests/unit/slotRules.test.ts`<br>`server/tests/api/slotMaintenance.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #67 |
| AC-54 | FR-12, FR-13 | F-07 | 2 | UI-08, E2E-11 | `client/tests/MySlotsPage.test.tsx`<br>`e2e/sprint2-slot-maintenance.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #67 |
| AC-55 | FR-15, BR-15 | F-09 | 2 | UNIT-12, API-40 | `server/tests/unit/bookingRules.test.ts`<br>`server/tests/api/attendance.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #68 |
| AC-56 | BR-15 | F-09 | 2 | UNIT-12, API-41 | `server/tests/unit/bookingRules.test.ts`<br>`server/tests/api/attendance.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #68 |
| AC-57 | FR-15 | F-09 | 2 | API-42 | `server/tests/api/attendance.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #68 |
| AC-58 | FR-15 | F-09 | 2 | UI-09, E2E-12 | `client/tests/SchedulePage.test.tsx`<br>`e2e/sprint2-attendance.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #68 |
| AC-59 | FR-14 | F-08 | 2 | API-43 | `server/tests/api/reschedule.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #69 |
| AC-60 | BR-16 | F-08 | 2 | API-44 | `server/tests/api/reschedule.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #69 |
| AC-61 | BR-16 | F-08 | 2 | API-45 | `server/tests/api/reschedule.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #69 |
| AC-62 | FR-14 | F-08 | 2 | UNIT-13, API-46 | `server/tests/unit/bookingRules.test.ts`<br>`server/tests/api/reschedule.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #69 |
| AC-63 | FR-14 | F-08 | 2 | UI-10, E2E-13 | `client/tests/ReschedulePage.test.tsx`<br>`e2e/sprint2-reschedule.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #69 |
| AC-64 | FR-18 | F-12 | 2 | API-47, API-49 | `server/tests/api/search.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #70 |
| AC-65 | FR-18 | F-12 | 2 | UNIT-14, API-48 | `server/tests/unit/searchRules.test.ts`<br>`server/tests/api/search.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #70 |
| AC-66 | NFR-11 | F-12 | 2 | PERF-01 | `server/tests/perf/perf.test.ts` | PASS | staging `4131d77`, CI 45763486080 | Sprint 1 release e5af45c |
| AC-67 | FR-18 | F-12 | 2 | UI-11, E2E-14 | `client/tests/SearchPage.test.tsx`<br>`e2e/sprint2-search.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #70 |
| AC-68 | NFR-08, NFR-09 | NFR-08/09 | 2 | E2E-15 | `e2e/sprint2-responsive.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #73 |
| AC-69 | FR-20 | F-15 | 3 | UNIT-15 | `server/tests/unit/dashboardRules.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #72 |
| AC-70 | FR-20 | F-15 | 3 | API-50 | `server/tests/api/dashboard.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #72 |
| AC-71 | FR-20 | F-15 | 3 | UI-12, E2E-16 | `client/tests/DashboardPage.test.tsx`<br>`e2e/sprint3-dashboard.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #72 |
| AC-72 | FR-19, BR-18 | F-14 | 3 | UNIT-16 | `server/tests/unit/templateRules.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #78 |
| AC-73 | FR-19, BR-18 | F-14 | 3 | API-51 | `server/tests/api/templates.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #78 |
| AC-74 | FR-19 | F-14 | 3 | API-52 | `server/tests/api/templates.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #78 |
| AC-75 | FR-19 | F-14 | 3 | UI-13, E2E-17 | `client/tests/TemplatesPage.test.tsx`<br>`e2e/sprint3-templates.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #78 |
| AC-76 | FR-21 | F-16 | 3 | UNIT-17, API-53 | `server/tests/unit/notificationRules.test.ts`<br>`server/tests/api/notifications.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #79 |
| AC-77 | FR-21 | F-16 | 3 | API-54 | `server/tests/api/notifications.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #79 |
| AC-78 | FR-21 | F-16 | 3 | UI-14, E2E-18 | `client/tests/NotificationsPage.test.tsx`<br>`e2e/sprint3-notifications.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #79 |
| AC-79 | BR-19 | F-17 | 3 | UNIT-18 | `server/tests/unit/bookingRules.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #77 |
| AC-80 | BR-19 | F-17 | 3 | API-55 | `server/tests/api/noShowPolicy.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #77 |
| AC-81 | FR-22 | F-17 | 3 | API-56 | `server/tests/api/accounts.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #77 |
| AC-82 | FR-22 | F-17 | 3 | API-57 | `server/tests/api/accounts.api.test.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #77 |
| AC-83 | FR-22 | F-17 | 3 | UI-15, E2E-19 | `client/tests/AccountsPage.test.tsx`<br>`e2e/sprint3-accounts.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #77 |
| AC-84 | NFR-09 | F-18 | 3 | E2E-20 | `e2e/a11y-audit.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #80 |
| AC-85 | NFR-08, NFR-09 | F-18 | 3 | E2E-21 | `e2e/sprint3-responsive.spec.ts` | PASS | staging `4131d77`, CI 45763486080 | PR #80 |
| AC-86 | NFR-11 | F-18 | 3 | PERF-02 | `server/tests/perf/perf.test.ts`<br>`server/tests/perf/deployed.perf.test.ts` | PERF-02 INCOMPLETE | staging `4131d77`, CI 45763486080 | — |
| AC-87 | NFR-13 | F-18 | 3 | MAN-03 | `scripts/release-check.sh` | PASS | staging `4131d77`, CI 45763486080 | PR #80 |

**Summary:** PASS 86; INCOMPLETE 1 (87 AC). Not yet PASS: AC-86.

