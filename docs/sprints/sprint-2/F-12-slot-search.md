# F-12 — Slot Search (Sprint 2 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-18, NFR-11, BR-02, BR-08, NFR-08, NFR-09, NFR-10 |
| Issue / owner / reviewer | Issue #55 — Simeon Audouit (author), Yanis Amrane (reviewer) |
| Depends on | F-04 (bookable-slot rules), F-11 (active services) |
| Contract version | 1.0 (2026-11-25) — history in §8 |

## 1. Behavior and Workflow

1. A new customer page **Find a Slot** (`/search`, navigation item after **Book a Slot**) has a search panel:
   **From** and **To** dates (default today and today + 6), **Service** (all or one active service) and
   **Staff** (all or one active staff member). **Book a Slot** (`/book`, one day) is unchanged, so the
   Sprint 1 flow and its tests stay as they are; `GET /api/slots/available` stays for `/book` and F-08.
2. **Search** calls `GET /api/slots/search`. The server returns the bookable slots whose Bangkok start date is
   between `from` and `to` inclusive, with **exactly the bookability conditions of F-04** (OPEN, start ≥ now +
   60 min, active service, no BOOKED booking) plus an **active staff member**, filtered by the optional
   `serviceId` and `staffId`, ordered by `startAt`, then `id`.
3. Results are grouped by day on the page ("Tue 2 Dec 2026 — 4 slots"); **Book** on a result opens the F-04
   booking dialog unchanged.
4. The search parameters are kept in the URL (`/search?from=…&to=…&serviceId=…&staffId=…`) so a reload or a
   shared link shows the same search.
5. Limits: the range is at most 14 days; `to ≥ from`; at most 200 results are returned with
   `truncated: true` when more match (the page says "Showing the first 200 slots. Narrow your search.").
6. NFR-11: with the seed data ×10, `GET /api/slots/search` (14-day range), `GET /api/slots/available` and
   `POST /api/bookings` answer in < 500 ms at p95 (PERF-01). The existing index `Slot(status, startAt)`
   serves the query; the implementation adds an index only if PERF-01 needs it, and records the decision in §8.

## 2. Pure Rule Function

`validateSearch(query, today)` in `server/src/rules/searchRules.ts` → `{ from, to, serviceId?, staffId? }` or
`{ fields }`: `from`/`to` valid ISO dates ("Enter a valid date (YYYY-MM-DD)."), `to ≥ from` ("The end date
must be on or after the start date."), range ≤ 14 days ("Search at most 14 days at a time."), `serviceId` /
`staffId` positive integers ("Choose a valid service." / "Choose a valid staff member."). A `from` in the past
is allowed (past slots are simply not bookable).

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/slots/search` | query `from`, `to` (required), `serviceId`, `staffId` (optional) | `200 { "slots": [SlotPublicView…], "truncated": false }` | 401, 403 (Staff), 422 `VALIDATION_ERROR` |
| `GET /api/staff-members` (new) | — | `200 { "staff": [{ "id": 1, "name": "Anan Wong" }…] }` active Staff, by name | 401 |

`SlotPublicView` from F-04: never any customer data. An unknown `serviceId`/`staffId` gives an empty list,
not an error. `GET /api/staff-members` returns names only (no e-mail).

## 4. UI (`/search`)

Search panel in a `<form role="search">`: From, To (`type=date`), Service and Staff selects with "All", **Search**
button; field errors under the fields. Results grouped by day (cards on mobile, table ≥ 768 px): time range,
service, staff, **Book**. Loading skeleton, empty "No available slots for this search. Try other dates or
filters.", error callout with Retry. No horizontal scroll at 320 px; keyboard only search and booking.

## 5. Data

No schema change. Test data for NFR-11: `server/tests/perf/seedTimes10.ts` adds 9 more copies of the seed
slots and bookings (other staff accounts and dates), only in the `_test` database.

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-64 | `GET /api/slots/search` returns only bookable slots (same conditions as F-04 plus active staff) whose Bangkok date is in `[from, to]`, filtered by `serviceId` and `staffId`, ordered by start then id, without customer data; a slot of a deactivated staff member or inactive service is not returned. |
| AC-65 | Invalid dates, `to < from`, a range over 14 days or a non-integer id → 422 with the messages of §2; a Staff member → 403; more than 200 matches → 200 results and `truncated: true`. |
| AC-66 | NFR-11: with the seed data ×10, the p95 of 100 calls each to `GET /api/slots/search` (14 days), `GET /api/slots/available` and `POST /api/bookings` is < 500 ms on a developer laptop; the timings are saved in `artifacts/sprint-2/perf/`. |
| AC-67 | UI: on **Find a Slot** a customer searches a 7-day range for one service and one staff member, sees the results grouped by day, books one, and after a reload of the same URL the booked slot is no longer listed. |

## 7. Failure / Boundary Cases

Range of exactly 14 days (from + 13, allowed) and 15 days (422), `from = to` (one day), slot at 00:00 or 23:45
Bangkok on a range edge (included by Bangkok date, NFR-10), slot exactly 60 min ahead (included) / 59 min
(excluded), `staffId` of a Customer account (empty list), 201 matching slots (200 + `truncated`).

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-25 | Yanis Amrane | Sprint 2 contract drafted for Simeon Audouit's Issue, recorded before implementation (Issue #49); reviewed by Simeon Audouit, the implementer. |
