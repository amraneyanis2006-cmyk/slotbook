# SlotBook — Feature Inventory

Stable feature IDs. "Owner" is the student who authors the feature PR in Sprint 1; the other student
reviews it. Later-sprint owners are planned and may change through the sprint planning of each sprint.

| ID | Feature | Short description | Requirements | Depends on | Sprint | Owner (S1) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| F-00 | Platform foundation | Repository layout, Prisma schema + first migration, idempotent seed, health check, test tooling, README setup. | NFR-06 (handler skeleton), NFR-07, NFR-10, NFR-12 (design) | — | 1 | Yanis |
| F-01 | Authentication and session | Login, logout, current user, session cookie, inactive accounts, role landing page. | FR-01, FR-02, FR-03, FR-04, BR-12, NFR-03, NFR-05 | F-00 | 1 | Yanis |
| F-02 | Access control and ownership | `requireAuth`, `requireRole`, ownership helpers, safe error handler, `GET /api/services`, protected-route guard in the UI. | BR-08, BR-09, NFR-01, NFR-02, NFR-06 | F-01 | 1 | Yanis |
| F-03 | Staff publishes slots | Staff creates a slot (service + date + start), lists own upcoming slots. | FR-05, FR-06, BR-06, BR-07, BR-08, BR-09, NFR-08, NFR-09, NFR-10 | F-02 | 1 | Yanis |
| F-04 | Browse and book a slot | Customer lists bookable slots and books one (transaction, reference). | FR-07, FR-08, BR-01, BR-02, BR-03, BR-04, BR-08, BR-10, NFR-04, NFR-08, NFR-09 | F-03 | 1 | Simeon |
| F-05 | My bookings and cancellation | Customer lists/opens own bookings and cancels inside the window; slot freed. | FR-09, FR-10, BR-05, BR-08, BR-09, BR-11, BR-13, NFR-08, NFR-09 | F-04 | 1 | Simeon |
| F-06 | Staff daily schedule | Staff sees one day of own slots with booking reference, customer and service. | FR-11, BR-08, BR-09, NFR-08, NFR-09 | F-04 | 1 | Simeon |
| F-07 | Slot maintenance | Edit an unbooked slot, close an open slot, cancel a booked slot with reason (cascade). | FR-12, FR-13, BR-14 | F-03, F-05 | 2 | Simeon |
| F-08 | Reschedule booking | Atomic move of a booking to another bookable slot of the same service. | FR-14, BR-16 | F-04, F-05 | 2 | Yanis |
| F-09 | Attendance outcome | Staff records COMPLETED / NO_SHOW after start. | FR-15, BR-15 | F-06 | 2 | Simeon |
| F-10 | Booking history | Append-only status history visible to Customer and Staff. | FR-16, BR-17 | F-05 | 2 | Yanis |
| F-11 | Service catalogue | Staff create/rename/change duration/deactivate services. | FR-17 | F-03 | 2 | Yanis |
| F-12 | Slot search | Customer search by service, staff and date range. | FR-18, NFR-11 | F-04 | 2 | Simeon |
| F-13 | Deployment pipeline | Dockerfile, docker-compose, CI (build + tests), Cloud Run + Cloud SQL deployment. | NFR-12 | F-00 | 2 (Lab 5) | Both |
| F-14 | Availability templates | Weekly template generating slots, with skipped report. | FR-19, BR-18 | F-07 | 3 | Simeon |
| F-15 | Staff dashboard | Utilisation, no-show rate, bookings per service. | FR-20 | F-09 | 3 | Yanis |
| F-16 | In-app notifications | Notify customers of staff cancellations/changes. | FR-21 | F-07, F-10 | 3 | Yanis |
| F-17 | Account overview and no-show policy | Staff list/deactivate customer accounts; booking suspension after repeated no-shows. | FR-22, BR-19, Q-03 | F-09 | 3 | Simeon |
| F-18 | Product hardening | Full accessibility audit, responsive polish, performance re-check, regression of all features. | NFR-08, NFR-09, NFR-11, NFR-13 | all | 3 | Both |

**Cross-cutting responsibilities.** NFR-01/02/06 are established by F-02 and re-verified by the API tests
of every later feature. NFR-08/09 are established on the Sprint 1 screens (F-03..F-06) and audited in F-18.
NFR-13 is a release-check responsibility of every sprint (see `traceability.md`).
