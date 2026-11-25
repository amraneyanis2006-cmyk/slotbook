# F-11 — Service Catalogue (Sprint 2 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-17, BR-02, BR-04 (A-04 resolved), BR-06, BR-08, NFR-06, NFR-08, NFR-09 |
| Issue / owner / reviewer | Issue #51 — Yanis Amrane (author), Simeon Audouit (reviewer) |
| Depends on | F-03 (services used by slots), F-10 (lands before) |
| Contract version | 1.0 (2026-11-25) — history in §8 |

## 1. Behavior and Workflow

1. The catalogue is **shared by all Staff** (SRS A-06): any active Staff member can create and change any
   service. Customers never manage services (403).
2. A Staff member opens **Services** (`/staff/services`): the list of all services, active first, then by
   name, each with its duration, status and the number of its upcoming non-cancelled slots.
3. **Create**: name + duration → `POST /api/staff/services` → the new service is active and appears at once in
   the slot form of F-03 and the service filter of F-04/F-12.
4. **Edit**: rename and/or change the duration → `PATCH /api/staff/services/:id`. A new duration applies
   only to slots created afterwards: an existing slot keeps its `startAt`/`endAt` (D-04 copies the duration
   into the slot at creation).
5. **Deactivate / reactivate**: `PATCH … { "isActive": false | true }`. An inactive service is hidden from the
   slot form and the customer filters; its OPEN slots stop being bookable at once (BR-02 already requires an
   active service); existing BOOKED bookings stay valid and visible.
6. **A-04 resolved.** Services can now last up to 120 min, longer than the 60 min booking lead time, so a
   booking that has already started can overlap a bookable slot. From this feature, the BR-04 query of
   F-04 (`bookingService.book`) compares against the customer's BOOKED bookings whose **end** is after now
   (was: whose start is after now). The BR-03 count (active **future** bookings) is unchanged.

## 2. Pure Rule Function

`validateService(input, { partial })` in `server/src/rules/serviceRules.ts` → `{ name?, durationMin?, isActive? }`
or `{ fields }`:

- `name`: trimmed, inner spaces collapsed, 3–60 characters → "Enter a name of 3 to 60 characters.";
- `durationMin`: integer, 15–120, multiple of 15 → "Choose a duration from 15 to 120 minutes in 15-minute steps.";
- `isActive`: boolean;
- with `partial: true` (PATCH) at least one field is required → `fields._` "Change at least one field.".

Name uniqueness is **case-insensitive** and checked by the service in the transaction (409, below) and by a
unique index on `lower(name)`.

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/staff/services` | — | `200 { "services": [ServiceAdminView…] }` all services, active first, then name | 401, 403 (Customer) |
| `POST /api/staff/services` | `{ "name": "Visa letter", "durationMin": 30 }` | `201 { "service": ServiceAdminView }` | 401, 403, 409 `SERVICE_NAME_TAKEN`, 422 `VALIDATION_ERROR` |
| `PATCH /api/staff/services/:id` | any of `{ "name", "durationMin", "isActive" }` | `200 { "service": ServiceAdminView }` | 401, 403, 404, 409 `SERVICE_NAME_TAKEN`, 422 |
| `GET /api/services` (unchanged) | — | active services only (F-02) | 401 |

```json
ServiceAdminView = { "id": 5, "name": "Visa letter", "durationMin": 30, "isActive": true, "upcomingSlots": 0 }
```

`409 SERVICE_NAME_TAKEN` message: "A service with this name already exists." There is no delete: a service
with slots must keep its history; deactivation is the way to retire it.

## 4. UI (`/staff/services`, Staff navigation item **Services**)

- Form "Add a service": Name (text, required), Duration (select 15…120 by 15). Field errors under the fields,
  409 under Name; success toast "Service added"; the list refreshes and the form is cleared.
- List: cards (mobile) / table (≥ 768 px): name, duration "30 min", status badge (Active / Inactive),
  upcoming slots, buttons **Edit** and **Deactivate** / **Reactivate**. **Edit** turns the row into an inline
  form (Save / Cancel). **Deactivate** opens a confirmation dialog: "Customers will no longer be able to book
  its open slots. Existing bookings stay." Loading skeleton, error callout with Retry.

## 5. Data

Migration `…_service_catalogue`: unique index `service_name_ci ON "Service"(lower(name))` (the existing
`name` unique index stays). The check constraint 15–120, multiple of 15, exists since F-00.

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-44 | A Staff member lists all services (with inactive ones and `upcomingSlots`), creates a service and renames it / changes its duration; the new service is returned by `GET /api/services` and can be used to publish a slot (F-03); a slot created before a duration change keeps its times. |
| AC-45 | Invalid name or duration → 422 with the field messages of §2; a name already used, in another case ("academic ADVISING") → 409 `SERVICE_NAME_TAKEN`; a Customer gets 403; an unknown id gets 404. Nothing is changed in these cases. |
| AC-46 | Deactivating a service removes it from `GET /api/services`, its OPEN slots from `GET /api/slots/available`, and booking one of them → 409 `SLOT_NOT_BOOKABLE`; its existing BOOKED booking is unchanged; reactivating restores both. |
| AC-47 | BR-04 (A-04): a customer whose 120-minute booking started 30 minutes ago cannot book a slot of another staff member that starts 60 minutes from now and overlaps it → 409 `BOOKING_OVERLAP`; a slot that starts when that booking ends is bookable. |
| AC-48 | UI: Staff adds "Visa letter (30 min)", sees it in the list and in the slot form, deactivates it through the dialog and sees the Inactive badge; the page has no horizontal scroll at 320 px and can be used with the keyboard. |

## 7. Failure / Boundary Cases

Name of exactly 3 and 60 characters (accepted), 2 and 61 (rejected), name with surrounding spaces (trimmed
before the uniqueness check), duration 15 and 120 (accepted), 0, 10, 135 (rejected), PATCH with no field (422),
PATCH renaming a service to its own name in another case (allowed: same id), deactivating an already
inactive service (200, no change), deactivated Staff session (401, BR-12).

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-25 | Yanis Amrane | Sprint 2 contract, recorded before implementation (Issue #49), reviewed by Simeon Audouit. |
