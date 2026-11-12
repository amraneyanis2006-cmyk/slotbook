# Sprint 1 — Engineering Contracts

| Item | File |
| :--- | :--- |
| F-00 Platform foundation | [F-00-platform.md](F-00-platform.md) |
| F-01 Authentication and session | [F-01-authentication.md](F-01-authentication.md) |
| F-02 Access control and ownership | [F-02-access-control.md](F-02-access-control.md) |
| F-03 Staff publishes slots | [F-03-staff-slots.md](F-03-staff-slots.md) |
| F-04 Browse and book a slot | [F-04-book-slot.md](F-04-book-slot.md) |
| F-05 My bookings and cancellation | [F-05-my-bookings.md](F-05-my-bookings.md) |
| F-06 Staff daily schedule (+ AC-30) | [F-06-staff-schedule.md](F-06-staff-schedule.md) |
| Software Test Specification | [sts.md](sts.md) |
| Product Definition of Done | [dod.md](dod.md) |

## Issues, Branches and Owners

| Issue | Scope | Branch | Author | Reviewer |
| :--- | :--- | :--- | :--- | :--- |
| #1 | Product docs (SRS, features, traceability, SDS, plan) + Sprint 1 contracts | `feature/1-sprint1-contracts` | Yanis | Simeon |
| #2 | F-00 Platform foundation | `feature/2-platform-foundation` | Yanis | Simeon |
| #3 | F-01 + F-02 Authentication and access control | `feature/3-auth-access` | Yanis | Simeon |
| #4 | F-03 Staff publishes slots | `feature/4-staff-slots` | Yanis | Simeon |
| #5 | F-04 Browse and book a slot | `feature/5-book-slot` | Simeon | Yanis |
| #6 | F-05 My bookings and cancellation | `feature/6-my-bookings` | Simeon | Yanis |
| #7 | F-06 Staff schedule + Sprint 1 E2E, responsive/a11y, screenshots | `feature/7-schedule-e2e` | Simeon | Yanis |
| #8 | Sprint 1 release: traceability, clean clone, release PR, tag | `release/sprint-1` | Simeon | Yanis |

Branch flow: `main` ← `sprint-1-staging` ← `feature/<issue>-<slug>`.

## Contract Version History

Any change to a contract after its PR is merged is made **in the PR that needs it**, with a row here and
a sentence in the PR body. The versions below number the contract set; each file also keeps its own version
number in its header and history (for example, set 1.3 = SRS 1.2, STS 1.2, SDS 1.2).

| Version | Date | File(s) | Author | Change and reason |
| :--- | :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-07 | all | Yanis Amrane | Initial Sprint 1 contracts, STS and DoD, recorded before any implementation (Issue #1). |
| 1.1 | 2026-11-07 | all | Yanis Amrane | Fixes from the pre-PR contract review (18 points, see PR #9) |
| 1.2 | 2026-11-10 | F-06-staff-schedule.md | Simeon Audouit | §2 summary: `closed` counts CLOSED slots **without** a booking, so the counts are disjoint and `total` = number of listed slots. Before, a CLOSED slot with a COMPLETED/NO_SHOW booking was counted twice (booked and closed). Issue #7. |
| 1.3 | 2026-11-10 | srs.md, sts.md, system-sds.md, traceability.md | Simeon Audouit | Decisions by Yanis Amrane for Issue #8: SRS §7 A-04 (BR-04 compares only against future bookings; review in Sprint 2 with F-11); STS UNIT-04 (query excludes the past, rule ignores non-BOOKED), NO_SHOW in UNIT-05 and API-23, E2E-06 depends on E2E-05, §6 red step for E2E-07/08, "Result" column filled from the release run; SDS §3.2 empty-state example = F-04 text, Node/PostgreSQL versions unified; traceability §4 lists 1.2 and 1.3. Issue #8. |
| 1.4 | 2026-11-10 | ../plan.md | Simeon Audouit | Sprint 1 is now 3 Nov – 15 Nov 2026 with the Deliverable 1 checkpoint on 15 Nov 23:59 (was 3 Nov – 8 Nov, 8 Nov 23:59); Sprint 2 is now 16 Nov – 29 Nov 2026 (was 9 Nov – 29 Nov), checkpoint 29 Nov unchanged. Reason: due date changed on LEB2. Requested by Yanis Amrane in the review of the Issue #8 PR. |
| 1.5 | 2026-11-11 | F-00-platform.md, sts.md, ../../traceability.md, ../../system-sds.md | Yanis Amrane | F-00 1.2: seed runs in production only with `SEED_DEMO_DATA=true` and `SEED_PASSWORD` (was: refuses production) and is insert-only there (missing services/users only, demo slots and bookings only on an empty database, counts printed) because the migration job reruns it on every release; `GET /api/ready`, production SPA serving with `index.html` fallback, `trust proxy`, startup refusal on a missing/short `SESSION_SECRET`; AC-33..AC-37; STS 1.3 adds UNIT-07, API-26, API-27, DB-03, DB-04; NFR-12 row updated; SDS 1.3 §4 (`/api/ready`) and §7 (variables). Reason: Lab 5 (cloud deployment, demo accounts for the Lab 6 UAT). Issue #20. |
| 1.6 | 2026-11-12 | F-00-platform.md, sts.md, ../../traceability.md, ../../labs/lab-05/deployment.md, ../../../README.md | Yanis Amrane | F-00 1.3: AC-38 graceful shutdown on SIGTERM; STS 1.4 adds UNIT-08; NFR-12 row names the Docker image, compose file, AC-38 and the C-03 evidence; deployment.md 0.2: §5 Docker (image, compose, why no nginx/separate Dockerfiles, PID 1/SIGTERM, no TZ), §2 `POSTGRES_PASSWORD` and `CLIENT_DIST` rows (0.1 was created in 1.5, Issue #20); README: `docker compose` command. Reason: Lab 5. Issue #21. |
| 1.7 | 2026-11-12 | ../../labs/lab-05/deployment.md, ../../traceability.md | Yanis Amrane | NFR-12 row names the CI job and the deploy-script tests; deployment.md 0.3: §4 GCP resource names and who creates them (deploy/deploy.sh, run by a human), §6 CI (ci-docker.yml jobs, artifacts, local commands). Reason: Lab 5. Issue #22. |
| 1.8 | 2026-11-12 | ../../labs/lab-05/deployment.md | Yanis Amrane | deployment.md 0.4: §4 GCP project `cpe334-slotbook-y`, region, alerts-only budget `CPE334-Alert`, teammate role Writer (`roles/writer`). Reason: Lab 5. Issue #19. |
| 1.9 | 2026-11-13 | ../../labs/lab-05/deployment.md, ../../traceability.md | Yanis Amrane | deployment.md 0.6: C-01 evidence in §6 (run 43270720258, commit 7ea5930, both jobs green, `artifacts/lab-05/test-output/ci-c01/`); NFR-12 row adds Issue #19 (GCP project, budget, IAM) and the C-01 run. Reason: Lab 5. Issues #19, #22. |
| 1.10 | 2026-11-13 | ../../labs/lab-05/deployment.md, ../../traceability.md | Yanis Amrane | deployment.md 0.7: §4 first deployment (2026-11-13, Cloud Shell, dry run 28 commands, `deploy.sh --demo`, revision `slotbook-00001-jcd`, smoke 4 PASS, URL; `example-gcp-project` in a dry run without `PROJECT_ID` is by design), §10 cost control; NFR-12 row adds Issue #23. Reason: Lab 5. Issue #23. |
