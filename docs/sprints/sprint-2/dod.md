# Sprint 2 — Definition of Done

The product Definition of Done of `../sprint-1/dod.md` (criteria 1–11) applies unchanged to every Sprint 2
feature and to the Sprint 2 release. This file only names the Sprint 2 evidence and the additions.

| # | Criterion (product DoD) | Sprint 2 evidence |
| :--- | :--- | :--- |
| 1 | Behavior implemented through UI → API → database | Feature PRs #50–#55 + screenshots in the Deliverable 2 PDF |
| 2 | Backend enforcement (401/403/404, BR-08, BR-09) | API-30, API-32, API-39, API-41, API-46, API-48 |
| 3 | Planned verification executed (STS IDs at the start of test names, no `.skip`/`.only`) | `artifacts/sprint-2/test-output/` |
| 4 | TDD red then green per Issue (STS §6) | `artifacts/sprint-2/tdd/issue-<n>-red.txt`, `issue-<n>-green.txt` |
| 5 | Full suites green, **Sprint 1 regression included** | Server, client and Playwright outputs of the release run (Issue #56) |
| 6 | Reviewed and approved on GitHub by the teammate | PR review pages (Simeon reviews Yanis's PRs and the reverse) |
| 7 | Integrated: feature PRs into `staging`, release PR into `main`, tag `v0.2.0-sprint2` | Git history, release PR, tag |
| 8 | Setup and documents current (README, `.env.example`, contracts, STS "Result") | Release PR diff |
| 9 | Safe (no secrets; errors expose no internals) | Release check grep, API-09 still green |
| 10 | Issue and board updated | GitHub Project board |
| 11 | Incomplete work disclosed | Release PR body and the Deliverable 2 PDF "Known limitations" |

**Sprint 2 additions**

| # | Criterion | Evidence |
| :--- | :--- | :--- |
| 12 | **Contracts before code**: the contract PR (#49) is merged before the first implementation commit of each feature; a later contract change has a version row with its reason. | Merge time of #49 vs. first commit of #50–#55 |
| 13 | **Migrations are safe on the deployed database**: every new migration runs on a copy of the production data shape (seed + backfill test DB-06) and is applied by the migration job of `deploy.yml`. | DB-06 output; Deploy run log |
| 14 | **Deployed and checked**: the release on `main` is deployed to Cloud Run by `deploy.yml`; `/api/version` shows the release commit; post-deployment checks of the Sprint 2 flows pass on the deployed URL. | Deploy run, `artifacts/sprint-2/post-deploy.md` |
| 15 | **Performance**: PERF-01 (NFR-11) passes and its timings are saved. | `artifacts/sprint-2/perf/` |
