# F-14 — Availability Templates (Sprint 3 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-19, BR-18, BR-06, BR-07, BR-08, BR-09, NFR-04, NFR-10 |
| Issue / owner / reviewer | Issue #59 — Simeon Audouit (author), Yanis Amrane (reviewer) |
| Depends on | F-03 (slot rules), F-07 (slot maintenance), F-11 (services) |
| Contract version | 1.0 (2026-11-25) — history in §8 |

## 1. Behavior and Workflow

1. A Staff member opens **Templates** (`/staff/templates`) and manages **their own** weekly templates: a name
   and a list of entries `{ weekday (1 = Monday … 7 = Sunday), startTime (HH:mm, 15-minute step), service }`.
2. **Generate**: the staff member picks a template and a date range (at most 31 days) →
   `POST /api/staff/templates/:id/generate { from, to }`. For every date of the range whose weekday has
   entries, one slot per entry is proposed (`endAt = start + service duration`, D-04).
3. Each proposed slot is checked with the F-03 rules (`validateSlot` for BR-06, `findOverlap` for BR-07 against
   the staff member's existing slots **and** the slots already accepted in this run). A slot that fails is
   **skipped** with its reason and never created; the others are created **in one transaction** under the
   staff row lock of F-03, so a run is all-or-nothing for the accepted slots (BR-18).
4. The answer lists the created slots and the skipped ones (`{ date, startTime, service, reason }`); the page
   shows "12 slots created, 2 skipped" with the skipped list.
5. Deleting a template never touches slots already generated.

## 2. Pure Rule Function

`planTemplateRun(entries, from, to, services, existing, now)` in `server/src/rules/templateRules.ts` →
`{ accept: TimeRange[], skipped: { date, startTime, serviceId, reason }[] }`, with `reason` one of the F-03
messages ("The slot must start in the future.", "Slots must be within opening hours (08:00–18:00).",
"Choose an active service.") or "You already have a slot at this time.". Dates are processed in order,
entries by start time.

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/staff/templates` | — | `200 { "templates": [Template…] }` own templates | 401, 403 |
| `POST /api/staff/templates` | `{ "name": "Term weeks", "entries": [{ "weekday": 1, "startTime": "09:00", "serviceId": 1 }] }` | `201 { "template": Template }` | 401, 403, 422 (name 3–60, 1–50 entries, weekday 1–7, time on a 15-min step, active service, no duplicate weekday + time) |
| `PUT /api/staff/templates/:id` | same body | `200 { "template": Template }` | 401, 403, 404, 422 |
| `DELETE /api/staff/templates/:id` | — | `204` | 401, 403, 404 |
| `POST /api/staff/templates/:id/generate` | `{ "from": "2026-12-01", "to": "2026-12-14" }` | `200 { "created": [SlotStaffView…], "skipped": [{ "date", "startTime", "service": { id, name }, "reason" }] }` | 401, 403, 404, 422 (dates, `to ≥ from`, ≤ 31 days) |

## 4. UI (`/staff/templates`)

List of templates with **Edit**, **Delete** (confirmation dialog) and **Generate**; template form with
repeatable entry rows (weekday select, start time select, service select, **Remove**), **Add entry**;
generate dialog with From/To and the result summary + skipped table. Keyboard operable, no horizontal scroll at 320 px.

## 5. Data

New tables `AvailabilityTemplate (id, staffId FK, name, createdAt)` and
`TemplateEntry (id, templateId FK ON DELETE CASCADE, weekday smallint 1–7, startTime char(5), serviceId FK)`,
unique `(templateId, weekday, startTime)`.

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-72 | `planTemplateRun` accepts valid slots and skips, with the F-03 reason, past slots, slots outside opening hours, inactive services and slots overlapping an existing or an already accepted slot. |
| AC-73 | Generating creates exactly the accepted slots in one transaction and returns them with the skipped list (200, BR-18); a second run on the same range creates nothing and skips every slot as overlapping. |
| AC-74 | Templates are owned: another staff member's template → 404; a Customer → 403; invalid bodies or ranges → 422 with field messages. |
| AC-75 | UI: Staff creates a template with two entries, generates two weeks and sees "N slots created, M skipped"; the new slots appear on **My Slots**. |

## 7. Failure / Boundary Cases

Range of exactly 31 days (allowed) / 32 (422), entry at 17:30 with a 45-min service (skipped: opening hours),
a range that starts today with entries earlier than now (skipped: future), concurrent generate and manual
create (serialised by the staff row lock).

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-25 | Yanis Amrane | Sprint 3 contract drafted for Simeon Audouit's Issue (Issue #57); reviewed by Simeon Audouit, the implementer. |
