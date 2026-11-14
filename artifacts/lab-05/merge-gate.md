# C-02 — A failing check blocks the merge (R-06), Issue #24

| Item | Value |
| :--- | :--- |
| Pull request | [#35](https://github.com/amraneyanis2006-cmyk/slotbook/pull/35) "C-02 proof - failing check must block the merge (DO NOT MERGE)", normal PR (not a draft), label `lab5`, author Simeon Audouit |
| Base / head | `main` ← temporary branch `test/24-failing-check` (created from `main` at `3845f83`) |
| Commit | `6506382` "test: deliberately failing test to prove the merge gate (C-02, do not merge)" |
| Change | `server/tests/unit/bookingRules.test.ts`: in **UNIT-03**, expected `formatReference(2026, 15)` changed from `'BK-2026-000015'` to `'BK-2026-000016'` (test only; no application code changed) |
| Local check | `cd server && npx vitest run tests/unit/bookingRules.test.ts` → 1 failed, 2 passed (`expected 'BK-2026-000015' to be 'BK-2026-000016'`) |
| CI run | [43559205082](https://github.com/amraneyanis2006-cmyk/slotbook/actions/runs/43559205082) (2026-11-14): **`test-and-docker` failure** (server tests: 1 failed, 62 passed; UNIT-03 `AssertionError`), `e2e` success |
| Merge state | GitHub `mergeStateStatus: BLOCKED`; merge box: "Some checks were not successful", `test-and-docker` marked **Required**, "Merging is blocked", Merge button disabled (no approval was given either, so the box names the missing review first) |
| Screenshot | `artifacts/lab-05/screenshots/issue-24/c02-merge-blocked.png` (no e-mail or secret visible) |
| Outcome | Closed **without merging** on 2026-11-14; the branch `test/24-failing-check` is **kept** (R-10). The released application was never touched: nothing reached `main`. |

The gate itself (rulesets `protect-main` / `protect-staging`, empty bypass list, required check `test-and-docker`,
up-to-date branches, 1 approval) is described in `docs/labs/lab-05/deployment.md` §11.
