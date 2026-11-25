# Sprint 3 — Software Test Specification (STS)

Version 1.0 (2026-11-25), written with the Sprint 3 contracts before any Sprint 3 code (Issue #57). Same
conventions as Sprints 1 and 2. F-15 is implemented in Deliverable 2 (Issue #58); the other rows are the plan
for Sprint 3 and are filled at the Sprint 3 release (13 Dec). Sprint 1 and Sprint 2 tests stay in the
regression suite.

| Test ID | AC | Level | Precondition / input | Expected result | File | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UNIT-15 | AC-69 | Unit | Slots OPEN/CLOSED with and without bookings; BOOKED past/future, COMPLETED, NO_SHOW; 3 services | Disjoint counts, `pending` = started BOOKED only, rate rounded to 3 decimals or null, `perService` ordered | `server/tests/unit/dashboardRules.test.ts` | Pending (#58) |
| API-50 | AC-70 | API | Anan's and Mali's slots over a period, a cancelled slot, a cancelled booking; Customer; bad periods | Only Anan's non-cancelled slots in range; figures of §2; 403; 422 messages; 92 days allowed, 93 refused | `server/tests/api/dashboard.api.test.ts` | Pending (#58) |
| UI-12 | AC-71 | UI | Mocked dashboard, rate null case | Four tiles with labels, "—" and the sentence for a null rate, per-service table, URL updated on Show | `client/tests/DashboardPage.test.tsx` | Pending (#58) |
| E2E-16 | AC-71 | E2E | Seed data (a COMPLETED and a NO_SHOW booking of Anan/Mali in the last days) | Anan opens Dashboard, sees the tiles and table; changes the period; no horizontal scroll at 320 px | `e2e/sprint3-dashboard.spec.ts` | Pending (#58) |
| UNIT-16 | AC-72 | Unit | Entries on several weekdays; existing slots; inactive service; times at the edges | Accepted and skipped lists with the F-03 reasons, in date then time order | `server/tests/unit/templateRules.test.ts` | Planned (#59) |
| API-51 | AC-73 | API | Template with 2 entries, 2-week range, one existing overlapping slot | 200 created + skipped; second run creates nothing | `server/tests/api/templates.api.test.ts` | Planned (#59) |
| API-52 | AC-74 | API | Other staff, Customer, invalid bodies/ranges | 404, 403, 422 | `server/tests/api/templates.api.test.ts` | Planned (#59) |
| UI-13 / E2E-17 | AC-75 | UI / E2E | Template form and generate dialog | Summary "N created, M skipped"; slots on My Slots | `client/tests/TemplatesPage.test.tsx`, `e2e/sprint3-templates.spec.ts` | Planned (#59) |
| UNIT-17 | AC-76 | Unit | Changes by customer and by staff | `null` for the customer, the §1 messages for staff | `server/tests/unit/notificationRules.test.ts` | Planned (#60) |
| API-53 | AC-76 | API | Staff cancel, outcome, deactivation; customer cancel and reschedule | One notification each for staff changes, none for customer changes, same transaction | `server/tests/api/notifications.api.test.ts` | Planned (#60) |
| API-54 | AC-77 | API | Two customers' notifications | Own only, newest first, unread count; read / read-all; 404; 403 | `server/tests/api/notifications.api.test.ts` | Planned (#60) |
| UI-14 / E2E-18 | AC-78 | UI / E2E | Staff cancels a booked slot | Customer header count, page, mark as read | `client/tests/NotificationsPage.test.tsx`, `e2e/sprint3-notifications.spec.ts` | Planned (#60) |
| UNIT-18 | AC-79 | Unit | No-show times around the 30-day and 7-day limits | Suspension end or null | `server/tests/unit/bookingRules.test.ts` | Planned (#61) |
| API-55 | AC-80 | API | Customer with 3 recorded no-shows | 409 `BOOKING_SUSPENDED` on book and reschedule; allowed after 7 days | `server/tests/api/noShowPolicy.api.test.ts` | Planned (#61) |
| API-56 | AC-81 | API | Customer with future and started bookings | Deactivate cancels future BOOKED with reason + history; session 401; reactivate | `server/tests/api/accounts.api.test.ts` | Planned (#61) |
| API-57 | AC-82 | API | Staff and customers | Customer list with columns; 403; 404 for staff id | `server/tests/api/accounts.api.test.ts` | Planned (#61) |
| UI-15 / E2E-19 | AC-83 | UI / E2E | Deactivate dialog | Bookings named; Inactive badge; customer redirected to login | `client/tests/AccountsPage.test.tsx`, `e2e/sprint3-accounts.spec.ts` | Planned (#61) |
| E2E-20 | AC-84 | E2E | Every route, both roles | axe-core: 0 serious/critical | `e2e/a11y-audit.spec.ts` | Planned (#62) |
| E2E-21 | AC-85 | E2E | Sprint 3 routes at 3 widths | No horizontal scroll / clipped control | `e2e/sprint3-responsive.spec.ts` | Planned (#62) |
| PERF-02 | AC-86 | Perf | Release candidate + deployed URL | PERF-01 green; deployed p95 recorded | `server/tests/perf/perf.test.ts`, `artifacts/sprint-3/perf/` | Planned (#62) |
| MAN-03 | AC-87 | Script | Release commit | `scripts/release-check.sh` exits 0 (no skip/only, every AC has a test) | `scripts/release-check.sh` | Planned (#62) |
