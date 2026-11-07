# Product Definition of Done (applies to every feature and every sprint release)

A feature or release is **Done** only when each line is true **and backed by evidence** (link, output
file, screenshot or reviewed PR). A statement by an AI agent is not evidence.

| # | Criterion | Evidence |
| :--- | :--- | :--- |
| 1 | **Behavior implemented**: every FR/BR of the feature contract works through UI → API → database as specified, including failure and boundary cases. | Feature PR + demo screenshots (Part F of the Deliverable 1 submission PDF) |
| 2 | **Backend enforcement**: authentication, role and ownership checks are on the server; no client-supplied identity is trusted. | API tests API-06..API-09 + feature 403/404 tests |
| 3 | **Planned verification executed**: every test of the STS for the feature exists at its file path with its ID at the start of the name and passes; no `.skip`, `.only` or weakened assertion. | Test output saved in `artifacts/sprint-1/test-output/` |
| 4 | **TDD**: failing-then-passing evidence for every implementation Issue, including the rule tests listed in STS §6. | `artifacts/sprint-1/tdd/issue-<n>-red.txt`, `issue-<n>-green.txt` with branch, commit hash, date and command |
| 5 | **Full suites green**: server, client and Playwright suites pass on the integration branch; counts of passed/failed/skipped recorded. | Test output files with command, commit and date |
| 6 | **Reviewed**: the PR was reviewed and **approved on GitHub by the teammate** (not the author) with a specific check, question or finding; requested changes are resolved. | PR review page |
| 7 | **Integrated**: merged into `sprint-1-staging`; the sprint release PR into `main` is reviewed and merged; release tag created. | Git history, release PR, tag `v0.1.0-sprint1` |
| 8 | **Setup and documents current**: README setup/commands, `.env.example`, contracts and STS "Result" column match the released code; contract changes are visible in the version history with a reason. | README, docs diff in PR |
| 9 | **Safe**: no secrets, `.env` files or real passwords committed; error responses expose no internals. | `.gitignore`, release check grep, API-09 |
| 10 | **Issue and board updated**: Issue linked to its feature/contract, branch and PR; card in **Done** only after the merge. | GitHub Project board |
| 11 | **Incomplete work disclosed**: anything not done, failed or skipped is listed in the PR and in Part F of the Deliverable 1 submission PDF "Known limitations". | PR body, Part F of the Deliverable 1 submission PDF |
