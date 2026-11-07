# SlotBook — Software Requirements Specification (SRS)

| Field | Value |
| :--- | :--- |
| Course | CPE 334 Software Engineering, Semester 1/2026, KMUTT |
| Team | EN-036 "Y Que Fue" — Yanis Amrane (69540460041), Simeon Audouit (65540460046) |
| Theme | 1 — Appointment and Scheduling System (Sprint 1 roles: Customer / Staff) |
| Product | **SlotBook** |
| Version | 1.0 (Deliverable 1 baseline) — history in §8 |

---

## 1. Stakeholder Problem and Chosen Context

**Context.** The *Student Service Center* of a university faculty (synthetic setting, inspired by KMUTT)
offers short face-to-face services: academic advising, document requests and career counselling.
Today students queue at the counter or send messages to individual officers; officers keep their
availability in personal calendars.

**Problem.**

- Students waste time queueing and often come when the right officer is not available.
- Officers get double-booked because two students are promised the same time by different channels.
- Nobody can see, for a given day, who is coming, for which service, and which slots are still free.
- No-shows and late cancellations block time that another student could have used.

**Goal.** A web application where **staff publish appointment slots** and **customers (students) book
one exclusive slot**, with the rules (no double booking, booking limits, cancellation window) enforced
by the backend, and a reliable record of every booking.

## 2. Actors and Responsibilities

| Actor | Description | Responsibilities in SlotBook |
| :--- | :--- | :--- |
| **Customer** | A student who needs a service. Seeded account (no self-registration). | Log in/out; browse available slots; book a slot; view own bookings; cancel own booking inside the allowed window. |
| **Staff** | A service-center officer who delivers the service. Seeded account. | Log in/out; publish own slots; view own slots and the bookings on them (daily schedule); later: close/cancel slots, record attendance, manage services. |
| **System** | The SlotBook backend. | Authenticates users, derives identity and role from the server session, enforces every business rule, stores bookings atomically. |
| *Course TA* (external) | Reviews the running system with seeded accounts. | Uses the documented local seed procedure. |

Two roles exist in the database: `CUSTOMER` and `STAFF`. Account administration is done by seed in
Sprint 1 (not required by the deliverable); a staff-side user overview is planned in Sprint 3.

## 3. Product Scope

### 3.1 Included (whole product, three sprints)

1. Authentication with email + password, server session, logout, current-user identity, role-based navigation.
2. Service catalogue (name, duration) used by slots.
3. Staff availability: create, list, edit, close and cancel exclusive appointment slots; recurring availability templates.
4. Customer booking: browse/search available slots, book, view own bookings, cancel, reschedule.
5. Staff operations: daily schedule, attendance outcome (completed / no-show), booking history.
6. Staff dashboard (utilisation, no-show rate) and in-app notifications of changes.
7. Hardening: responsive UI (320/768/1280 px), accessibility, performance smoke tests, Docker packaging,
   CI/CD and GCP deployment (Lab 5).

### 3.2 Explicit Exclusions

- Self-registration, password recovery, e-mail/SMS sending, social login.
- Payments, deposits or fees.
- Group/multi-capacity sessions (every slot is **exclusive**: one customer).
- Integration with external calendars (Google/Outlook).
- Native mobile apps (responsive web only).
- Multi-tenant (several faculties) and multi-language UI (English only).

## 4. Functional Requirements (FR)

Sprint allocation is detailed in `features.md` and `traceability.md`.

| ID | Requirement (observable behavior) | Sprint |
| :--- | :--- | :--- |
| FR-01 | A user logs in with email and password; on success the system creates a server session and returns the user's id, name, email and role (never the password hash). | 1 |
| FR-02 | A logged-in user logs out; the session is destroyed and later requests with the old cookie are unauthenticated. | 1 |
| FR-03 | The application retrieves the current user from the session (`GET /api/auth/me`) and shows the user's name and role in the header. | 1 |
| FR-04 | After login each role lands on its own home page and sees only its own navigation (Customer: Book a Slot, My Bookings; Staff: My Slots, Schedule). | 1 |
| FR-05 | A Staff member creates an appointment slot for a service by choosing a date and start time; the end time is computed from the service duration. | 1 |
| FR-06 | A Staff member lists their own upcoming slots with each slot's status and, if booked, the booking reference and customer name. | 1 |
| FR-07 | A Customer lists the bookable slots (open, in the future, not booked), filtered by date and optionally by service, ordered by start time. | 1 |
| FR-08 | A Customer books one bookable slot; the system stores a booking with a unique reference and shows a confirmation. | 1 |
| FR-09 | A Customer lists their own bookings (upcoming first, then past/cancelled) and opens a booking's detail; the data persists across reloads and sessions. | 1 |
| FR-10 | A Customer cancels one of their own active bookings; the slot becomes bookable again. | 1 |
| FR-11 | A Staff member views the schedule of one day: their own slots in time order with booking reference, customer name and service. | 1 |
| FR-12 | A Staff member edits the time of an unbooked slot or closes an open slot so that it can no longer be booked. | 2 |
| FR-13 | A Staff member cancels a slot that has a booking, giving a reason; the booking is cancelled and the customer sees the reason. | 2 |
| FR-14 | A Customer reschedules an active booking to another bookable slot of the same service in one operation. | 2 |
| FR-15 | A Staff member records the outcome of a past booking on their slot: COMPLETED or NO_SHOW. | 2 |
| FR-16 | Customers and Staff see the status history of a booking (who changed what, when, why). | 2 |
| FR-17 | A Staff member manages the service catalogue (create, rename, change duration, deactivate). | 2 |
| FR-18 | A Customer searches bookable slots by service, staff member and date range. | 2 |
| FR-19 | A Staff member defines a weekly availability template that generates slots for a date range. | 3 |
| FR-20 | A Staff member sees a dashboard: booked vs. open slots, no-show rate and bookings per service for a period. | 3 |
| FR-21 | Customers receive in-app notifications when a booking is cancelled or changed by staff. | 3 |
| FR-22 | A Staff member sees the list of user accounts and can deactivate a customer account. | 3 |

## 5. Business Rules (BR)

| ID | Rule | Error when violated | Sprint |
| :--- | :--- | :--- | :--- |
| BR-01 | **Exclusive slot.** A slot holds at most one active booking (status `BOOKED`). Enforced by the application **and** by a partial unique index in the database. | 409 `SLOT_ALREADY_BOOKED` | 1 |
| BR-02 | **Bookable only in the future.** A slot can be booked only if it is `OPEN` and its start time is at least 60 minutes after the current time. | 409 `SLOT_NOT_BOOKABLE` | 1 |
| BR-03 | **Booking limit.** A Customer may hold at most 3 active future bookings at the same time. | 409 `BOOKING_LIMIT_REACHED` | 1 |
| BR-04 | **No overlapping bookings.** A Customer cannot hold two active bookings whose time ranges overlap. | 409 `BOOKING_OVERLAP` | 1 |
| BR-05 | **Cancellation window.** A Customer can cancel an active booking only until 2 hours before its start. | 409 `CANCELLATION_WINDOW_CLOSED` | 1 |
| BR-06 | **Valid slot.** A slot's start is in the future, aligned to 15 minutes, and the whole slot lies inside opening hours 08:00–18:00 Asia/Bangkok on the same day; its service must be active. | 422 `VALIDATION_ERROR` (with `fields`) | 1 |
| BR-07 | **No overlapping slots per staff.** Two non-cancelled slots of the same Staff member cannot overlap in time. | 409 `SLOT_OVERLAP` | 1 |
| BR-08 | **Server-side identity.** The acting user, their role, the slot owner (`staffId`) and the booking owner (`customerId`) are always taken from the server session, never from the request body or query. | ignored / 403 | 1 |
| BR-09 | **Ownership.** A Customer can read and change only their own bookings; a Staff member can read and change only their own slots. Records of others are answered with 404 (no data, no existence leak). | 404 `NOT_FOUND` | 1 |
| BR-10 | **Booking reference.** Every booking gets a unique, immutable reference `BK-YYYY-NNNNNN` (year of creation, 6-digit sequence). | — | 1 |
| BR-11 | **Freed slot.** When a booking is cancelled, its slot becomes bookable again (subject to BR-02). | — | 1 |
| BR-12 | **Inactive accounts.** An inactive account cannot log in; an existing session of a deactivated user is rejected. | 401 `INVALID_CREDENTIALS` / 401 `UNAUTHENTICATED` | 1 |
| BR-13 | **Only active bookings change.** A booking that is `CANCELLED`, `COMPLETED` or `NO_SHOW` cannot be cancelled or rescheduled. | 409 `BOOKING_NOT_ACTIVE` | 1 |
| BR-14 | **Staff slot changes.** A booked slot cannot be edited or closed; it can only be cancelled with a reason (cascades the booking to `CANCELLED`). | 409 `SLOT_HAS_BOOKING` | 2 |
| BR-15 | **Attendance after start.** An outcome (COMPLETED / NO_SHOW) can be recorded only after the slot start time and only for a `BOOKED` booking. | 409 `OUTCOME_TOO_EARLY` | 2 |
| BR-16 | **Atomic reschedule.** A reschedule cancels the old booking and books the new slot in one transaction, re-checking BR-01..BR-05 (excluding the old booking). Either both happen or neither. | as BR-01..05 | 2 |
| BR-17 | **Append-only history.** Every booking status change appends a history record (actor, from, to, reason, time); history is never edited. | — | 2 |
| BR-18 | **Template generation.** Slots generated from a template that would violate BR-06/BR-07 are skipped and reported, never partially created. | 200 with `skipped[]` | 3 |
| BR-19 | **No-show limit.** A Customer with 3 NO_SHOW outcomes in the last 30 days cannot make a new booking for 7 days. | 409 `BOOKING_SUSPENDED` | 3 |

## 6. Non-Functional Requirements (NFR)

| ID | Requirement and measurable target | Verification method | Established / verified |
| :--- | :--- | :--- | :--- |
| NFR-01 | **Authentication required.** Every `/api` endpoint except `POST /api/auth/login` and `GET /api/health` rejects a request without a valid session with 401 and returns no private data. | API tests on every protected route (table-driven) | Sprint 1 |
| NFR-02 | **Authorization at the backend.** Every protected operation checks role and ownership on the server; 100 % of the role/permission matrix cells are covered by an API test. | API tests (403/404 cases) | Sprint 1 |
| NFR-03 | **Password safety.** Passwords are stored only as bcrypt hashes (cost ≥ 10); no response, log or seed file contains a plaintext password or hash. | Unit test + API response assertions + repository grep in release check | Sprint 1 |
| NFR-04 | **Concurrency safety.** When two booking requests for the same slot run in parallel, exactly one succeeds and the other gets 409; the database never contains two active bookings for one slot. | API test with `Promise.all` + DB constraint check | Sprint 1 |
| NFR-05 | **Session lifetime.** Session cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, expires after 8 h of inactivity; logout destroys the server-side session immediately. | API tests (cookie flags, reuse after logout) | Sprint 1 |
| NFR-06 | **Safe errors.** Error responses use `{ error, message, fields? }`; no stack trace, SQL or internal path in any response, including 500. | API tests on forced errors | Sprint 1 |
| NFR-07 | **Reproducible setup.** From a clean clone, the documented commands (install, migrate, seed, test, run) complete without manual edits; the seed is idempotent (running it twice gives the same data). | Clean-clone check recorded at release | Sprint 1 |
| NFR-08 | **Responsive UI.** Every Sprint screen works at 320, 768 and 1280 px width without horizontal page scroll or clipped controls. | Playwright viewport tests + screenshots | Sprint 1 (S1 screens), each later sprint for its screens |
| NFR-09 | **Accessibility baseline.** Every form control has a visible label; errors are announced (`role="alert"`) and linked to fields; all actions are keyboard-reachable with a visible focus ring. | Component tests + Playwright keyboard test | Sprint 1 baseline; full audit Sprint 3 |
| NFR-10 | **Time correctness.** All times are stored in UTC; the UI displays and accepts Asia/Bangkok local time; rules (BR-02, BR-05, BR-06) use server time. | Unit tests with fixed clock | Sprint 1 |
| NFR-11 | **Performance.** With the seed data ×10, `GET /api/slots/available` and `POST /api/bookings` respond in < 500 ms at p95 on a developer laptop. | Performance smoke test | Sprint 2 |
| NFR-12 | **Deployability.** All configuration comes from environment variables; the app is stateless (sessions in PostgreSQL); it runs as a Docker image against Cloud SQL on GCP Cloud Run. | Docker build + CI pipeline + deployment check | Design in Sprint 1, verified in Sprint 2 (Lab 5) |
| NFR-13 | **Test discipline.** Every AC maps to at least one automated test whose name starts with its test ID; no skipped or `.only` tests on a release. | Traceability check at release | Every sprint |

## 7. Assumptions, Decisions, Questions and Resolutions

| ID | Type | Statement | Resolution / rationale |
| :--- | :--- | :--- | :--- |
| D-01 | Decision | Stack = TypeScript, Express, Prisma, PostgreSQL, React + Vite, Vitest, Supertest, Testing Library, Playwright. | Same stack as the team's TokTickIT labs: known, testable, Docker-friendly. |
| D-02 | Decision | Session-cookie authentication (`express-session` + PostgreSQL session store) rather than JWT. | Logout invalidates immediately (NFR-05); no token storage in the browser. |
| D-03 | Decision | Slots are exclusive (capacity 1). | Theme example ("occupied exclusive slot"); group sessions excluded (§3.2). |
| D-04 | Decision | Slot end = start + service duration (no free end time). | Removes a whole class of invalid input; durations come from the service catalogue. |
| D-05 | Decision | Exclusivity enforced by a **partial unique index** `Booking(slotId) WHERE status = 'BOOKED'` plus an application check. | The application check gives a clear error; the index guarantees NFR-04 under concurrency. |
| D-06 | Decision | Other users' records return **404**, wrong role returns **403**. | 404 avoids revealing that a booking exists (BR-09); 403 is the correct answer for a role that never has access. |
| A-01 | Assumption | Opening hours are 08:00–18:00 Asia/Bangkok, every day; holidays are not modelled in Sprint 1. | Holiday closures can be done by closing slots (FR-12, Sprint 2). |
| A-02 | Assumption | Accounts are created by the seed (2 Staff, 3 Customers, 1 inactive Customer). | Self-registration excluded by the deliverable (§2 of the brief). |
| A-03 | Assumption | Services are seeded in Sprint 1 (3 services) and managed by Staff from Sprint 2 (FR-17). | Keeps Sprint 1 small. |
| Q-01 | Question | Can a Staff member book on behalf of a Customer (phone call)? | Resolved: **not in scope** for Sprint 1–3; Customers book themselves. Revisit after Sprint 3 if time allows. |
| Q-02 | Question | Should a Customer see the Staff member's name before booking? | Resolved: **yes**, slot list shows staff name and service. |
| Q-03 | Question | What happens to bookings when a Customer account is deactivated (FR-22)? | Resolved: future active bookings are cancelled with reason "account deactivated" (Sprint 3, BR-17 history). |

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-07 | Yanis Amrane (with AI assistance, see ai-use) | Baseline SRS for Deliverable 1, reviewed by Simeon Audouit in the contract PR. |
