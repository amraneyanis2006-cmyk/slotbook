# SlotBook — Change and Defect Register

One row per approved change or defect after the Deliverable 1 release (`v0.1.0-sprint1`, release PR #17), with its
evidence. Contract-level detail stays in the version history of each contract; this file is the index.

## 1. Changes

| ID | Date | What changed | Why | Approved by | Issue / PRs | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Lab 5 | 11–14 Nov | Cloud deployment: `/api/ready`, `/api/version`, production seed opt-in, Docker image, CI `test-and-docker`, `deploy.yml`, rulesets | Lab 5 (NFR-12) | Team; merge gate | #19–#26, PRs #27–#41 | AC-33..AC-39, C-01..C-06 (`docs/labs/lab-05/deployment.md`) |
| CR-01 | 25 Nov | BR-05 cancellation cutoff 2 h → 24 h (exactly 24 h allowed) | Lab 7 maintenance change | TA (mail of 25 Nov), contract reviewed by Simeon | #45, PRs #46, #47, #48 | UNIT-05, API-22/23, UI-04, SHOT-01; post-deployment checks PD-01..06 (`docs/labs/lab-07/`) |
| S2-01 | 25 Nov | SRS A-04 resolved: BR-04 compares against bookings that have not ended (services up to 120 min) | A booking that has started could overlap a bookable slot once F-11 allows 120 min | Yanis (SRS 1.4), reviewed by Simeon | #49, #51 | API-34, UNIT-04 |
| S2-02 | 25 Nov | SRS A-05: a reschedule respects the 24 h window of BR-05 | Same rule as cancel + rebook | Yanis, reviewed by Simeon | #49, #54 | API-46 |
| S2-03 | 25 Nov | F-10 1.1: backfill times never before `createdAt`; one backfill SQL file shared by the migration and the seed | Found while writing DB-06 | Yanis, reviewed in the #50 PR | #50 | DB-06 |
| S2-04 | 25 Nov | `GET /api/bookings/:reference` and `GET /api/staff/schedule` gain fields (`history`, `canRecordOutcome`) | F-10, F-09 | Contracts 2.0 | #50, #53 | API-20, API-24 (STS Sprint 2 §7) |
| S3-01 | 26 Nov | F-17 1.1: `activeBookingRefs` in the account list (the deactivate dialog names the bookings it cancels); BR-19 date formatted in Bangkok time | Found while implementing the dialog | Simeon (author), reviewed by Yanis in the #61 PR | #61 | API-57, UI-15, API-55 |
| S3-02 | 26 Nov | F-18 1.1: the deployed part of PERF-02 is read-only (search and available); booking latency stays measured on the release candidate | 30 bookings in production would change the demo data and the dashboard figures | Yanis, reviewed by Simeon in the #62 PR | #62 | PERF-02 |
| S3-03 | 26 Nov | Accent colour `#1f6feb` → `#1a5fcf` (all screens) | Contrast defect D-05 | Yanis, reviewed by Simeon in the #62 PR | #62 | E2E-20 |
| S3-04 | 26 Nov | `scripts/release-check.sh` added as a CI step of `test-and-docker` | NFR-13 checked on every PR, not only at release | Yanis, reviewed by Simeon in the #62 PR | #62 | MAN-03 |
| S3-05 | 26 Nov | Notifications written by `recordStatusChange` (the single history writer), so F-07, F-09 and F-17 notify without changing their code | One transaction for status, history and notification (F-16 §1 step 2) | Contract F-16 1.0 | #60 | API-53 |

## 2. Defects

| ID | Found | Defect | Severity | Fix | Issue / PRs | Regression test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| D-01 | Lab 6 UAT (Group Paris), 22 Nov | Book a Slot kept the previous date's slots (with Book buttons) when the date field was emptied | Medium (wrong data shown) | Clear the list and ask for a date | #43, PR #44 | UI test of PR #44; re-test by Group Paris PASS |
| D-02 | Lab 6 controlled exercise | The same defect reintroduced on purpose on `staging` to check that UAT finds it | — (exercise) | Reverted by PR #44 | PR #42 | as D-01 |
| D-03 | Sprint 2 implementation | History label broke the strict Sprint 1 check E2E-05 | Low (test-only symptom) | One text node per history line | #50 | E2E-05, UI-06 |
| D-04 | Sprint 2 implementation (E2E-15) | Esc on the Cancel slot / Edit time dialog lost the keyboard focus | Low (NFR-09) | Menu stays open while its dialog is open | #52 | E2E-15 |
| D-05 | F-18 accessibility audit (E2E-20), 26 Nov | `color-contrast` (serious) on 13 routes: badge and secondary-button text `#1f6feb` gave 4.0:1 on `#e8effd` (WCAG AA needs 4.5:1) | Medium (NFR-09) | Accent `#1a5fcf` (5.1:1 on the badge, 5.9:1 on white) | #62 | E2E-20 |
| D-06 | Full local Playwright run, 26 Nov | E2E-15 (18 page loads) took 30.1 s under full-suite load and hit the 30 s default timeout | Low (test-only) | Timeout raised to 60 s for this screen loop, like E2E-20/21 | #62 | E2E-15 |
| D-07 | Local test of the durability script, 26 Nov | The deployed PERF-02 test (and the new script) sent the next request before reading the whole login answer; the session is stored before the response ends, so that request could get 401 (about 1 in 4 locally). The app is not affected: a browser reads the whole answer | Low (test-only) | Both read the login answer first (60/60 OK locally) before PERF-02 ran on production | `evidence/final-checks` | PERF-02 |

## 3. Sprint 1 Still Works

The full Sprint 1 suite (UNIT-01..08, API-01..28, DB-01..04, UI-01..05, E2E-01..08) runs unchanged in every CI run
of Sprint 2; the only Sprint 1 tests edited are listed in `sprints/sprint-2/sts.md` §7, each with its reason.
