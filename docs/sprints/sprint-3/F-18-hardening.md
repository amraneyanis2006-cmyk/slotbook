# F-18 — Product Hardening (Sprint 3 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | NFR-08, NFR-09 (full audit), NFR-11 (re-check), NFR-13 |
| Issue / owner / reviewer | Issue #62 — Yanis Amrane and Simeon Audouit (pair), each reviews the other's commits |
| Depends on | F-14 … F-17 (last item of Sprint 3) |
| Contract version | 1.0 (2026-11-25) — history in §8 |

## 1. Scope

1. **Accessibility audit (NFR-09)** of every screen with axe-core in Playwright (`@axe-core/playwright`):
   no `serious` or `critical` violation; keyboard walk-through of every dialog and menu; findings fixed or
   listed with a reason in the release notes.
2. **Responsive check (NFR-08)** of every route at 320, 768 and 1280 px (E2E-07 and E2E-15 extended to the
   Sprint 3 screens).
3. **Performance re-check (NFR-11)**: PERF-01 re-run on the release candidate and on the deployed service
   (search and booking from the Cloud Run URL, 30 calls each, p95 recorded).
4. **Regression and test discipline (NFR-13)**: full server, client and Playwright suites on the release
   commit; a script fails the release check if a test is skipped or focused, or if an AC of `traceability.md`
   has no test ID.

## 2. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-84 | axe-core finds no serious or critical violation on any route (E2E-20). |
| AC-85 | Every route has no horizontal scroll or clipped control at 320, 768, 1280 px (E2E-07, E2E-15, E2E-21). |
| AC-86 | PERF-01 passes on the release candidate; the deployed p95 for search and booking is recorded. |
| AC-87 | The release check script reports 0 skipped/focused tests and 0 ACs without a test ID. |

## 3. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-25 | Yanis Amrane | Sprint 3 contract (Issue #57), reviewed by Simeon Audouit. |
