# SlotBook — System-Level Software Design Specification (SDS)

Version 1.4 (2026-11-14). Applies to the whole product; Sprint 1 feature contracts in
`docs/sprints/sprint-1/` give the detailed endpoints and screens.

---

## 1. Architecture and Stack

```mermaid
flowchart LR
  subgraph Browser
    UI["React SPA (Vite, TypeScript)<br/>pages, forms, route guards"]
  end
  subgraph Server["Node.js 20+ — Express API (TypeScript)"]
    R["Routes /api/*<br/>(HTTP + input validation)"]
    M["Middleware<br/>session, requireAuth, requireRole, error handler"]
    S["Domain services<br/>slotService, bookingService<br/>(business rules BR-01..BR-13)"]
    P["Prisma Client"]
  end
  DB[("PostgreSQL 16+<br/>users, services, slots, bookings, session<br/>constraints + partial unique index")]
  UI -- "HTTPS JSON, session cookie" --> R
  R --> M --> S --> P --> DB
```

| Layer | Technology | Responsibility |
| :--- | :--- | :--- |
| UI | React 18 + Vite, TypeScript, React Router, plain CSS design tokens (`client/src/styles/theme.css`) | Screens, client-side form hints, loading/empty/error states, role navigation, route guards (**convenience only, never authorization**). |
| API / application | Node.js 20 or newer, at least 20.12 (tested with 20 and 24), Express 4, TypeScript, `zod` for request validation, `express-session` + `connect-pg-simple`, `bcrypt` | Authentication, session, role and ownership checks, request validation, domain services that enforce every business rule inside database transactions, safe error mapping. |
| Persistence | PostgreSQL 16 or newer (tested with 16 and 18), Prisma ORM + Prisma Migrate | Durable storage, foreign keys, unique constraints, the partial unique index for exclusive slots (BR-01), booking-reference sequence (BR-10), session table. |
| Tests | Vitest + Supertest (server unit/API/DB), Vitest + Testing Library (client), Playwright (E2E, responsive, keyboard) | Automated verification mapped to AC IDs. |

**Communication.** The SPA calls the API with `fetch` on the same origin (`/api/...`); in development
the Vite dev server proxies `/api` to `http://localhost:3000`, in production Express serves the built
SPA and the API from one container, so the session cookie is first-party and `SameSite=Lax` works.

**Where business rules are enforced.** In the **domain services** on the server (`server/src/services/`),
called by the routes after authentication and authorization middleware. Pure rule functions
(`server/src/rules/`) are unit-tested with a fixed clock. The database adds a last line of defence for
the rules that must survive concurrency (BR-01 partial unique index; foreign keys; unique reference).
The UI repeats some checks only to give early feedback.

### 1.1 Repository Layout

```text
slotbook/
  server/            Express API — src/{app.ts, index.ts, config/, routes/, middleware/, services/, rules/, utils/}
    prisma/          schema.prisma, migrations/, seed.ts
    tests/           unit/, api/, db/  (Vitest)
  client/            React SPA — src/{pages/, components/, api/, auth/, styles/}, tests/ (Vitest)
  e2e/               Playwright specs + global-setup.ts
  docs/              srs.md, features.md, traceability.md, system-sds.md, sprints/
  artifacts/         sprint-1/{screenshots/, test-output/, tdd/}
  README.md          setup, commands, seeded accounts procedure
```

## 2. Data Model

```mermaid
erDiagram
  User ||--o{ Slot : "publishes (staffId)"
  User ||--o{ Booking : "makes (customerId)"
  Service ||--o{ Slot : "is delivered in"
  Slot ||--o{ Booking : "has (max 1 BOOKED)"
  User { int id PK
         string email UK
         string name
         string passwordHash
         Role role
         bool isActive }
  Service { int id PK
            string name UK
            int durationMin
            bool isActive }
  Slot { int id PK
         int staffId FK
         int serviceId FK
         datetime startAt
         datetime endAt
         SlotStatus status }
  Booking { int id PK
            string reference UK
            int slotId FK
            int customerId FK
            BookingStatus status
            string note
            datetime cancelledAt
            int cancelledById FK }
```

| Entity | Important fields and constraints | Ownership |
| :--- | :--- | :--- |
| `User` | `email` unique, lower-cased; `passwordHash` bcrypt (never selected in API responses); `role` enum `CUSTOMER`/`STAFF`; `isActive` default true; timestamps. | Self. |
| `Service` | `name` unique; `durationMin` 15–120 and multiple of 15 (check constraint); `isActive`. | Managed by Staff (Sprint 2). |
| `Slot` | `staffId` → User(STAFF); `serviceId` → Service; `startAt`/`endAt` timestamptz (UTC), `endAt > startAt` (check constraint); `status` enum `OPEN`/`CLOSED`/`CANCELLED`; index `(staffId, startAt)`, `(status, startAt)`. Overlap per staff (BR-07) checked in the transaction while holding a row lock on the staff user. | The Staff member in `staffId`. |
| `Booking` | `reference` unique `BK-YYYY-NNNNNN` from PostgreSQL sequence `booking_ref_seq`; `slotId` → Slot; `customerId` → User(CUSTOMER); `status` enum `BOOKED`/`CANCELLED`/`COMPLETED`/`NO_SHOW`; `note` ≤ 300 chars; `cancelledAt`, `cancelledById`; **partial unique index `booking_one_active_per_slot ON "Booking"("slotId") WHERE status = 'BOOKED'`**; index `(customerId, status)`. | The Customer in `customerId`; readable by the slot's Staff member. |
| `session` | `sid` PK, `sess` json, `expire` timestamptz (+ index) — table used by `connect-pg-simple`, created by a Prisma migration so the schema stays reproducible. | System. |
| *Sprint 2+* | `BookingStatusChange` (append-only history, BR-17), `AvailabilityTemplate` (Sprint 3), `Notification` (Sprint 3). | — |

**Times.** All timestamps are stored as UTC `timestamptz`. The API accepts local dates/times
(`date: "YYYY-MM-DD"`, `startTime: "HH:mm"`) interpreted in `Asia/Bangkok` (UTC+7, no DST) and
returns ISO-8601 UTC strings; the UI formats them in Asia/Bangkok (NFR-10).

### 2.1 Database Setup, Migrations and Seed

- `server/prisma/schema.prisma` is the source of truth; every change is a Prisma migration committed in
  `server/prisma/migrations/`. Raw SQL inside migrations adds what Prisma cannot express: the partial
  unique index, check constraints, the `booking_ref_seq` sequence and the `session` table.
- Commands (root `package.json`): `npm run db:migrate` (`prisma migrate deploy`), `npm run db:migrate:dev`,
  `npm run db:seed`, `npm run db:reset` (dev only).
- **Seed (`server/prisma/seed.ts`) is idempotent** (upsert by natural keys; two runs in a row give the
  same counts): 3 active services (Academic advising 30 min, Document request 15 min, Career counselling
  45 min) + 1 inactive (Thesis consultation, 60 min); 2 Staff, 3 Customers (one with no booking) and
  1 inactive Customer, all with synthetic `@slotbook.test` e-mails and the local password from
  `SEED_PASSWORD`; slots at fixed local times on today−2 .. today+7 relative to the seed date (open,
  booked, closed, past), keyed by (`staffId`, `startAt`); bookings in every Sprint 1 status, keyed by
  (`slotId`, `customerId`). The seed refuses to
  run when `NODE_ENV=production`.

## 3. UI Conventions

### 3.1 Screens and Navigation

| Route | Role | Screen | Sprint |
| :--- | :--- | :--- | :--- |
| `/login` | public | Login form | 1 |
| `/book` | Customer (home) | Book a Slot — date + service filter, bookable slot list, booking dialog | 1 |
| `/bookings`, `/bookings/:reference` | Customer | My Bookings (Upcoming / Past and cancelled), booking detail, cancel | 1 |
| `/staff/slots` | Staff (home) | My Slots — create-slot form + upcoming slots | 1 |
| `/staff/schedule` | Staff | Daily schedule | 1 |
| `/staff/services`, `/staff/dashboard`, `/staff/users` | Staff | Service catalogue, dashboard, accounts | 2–3 |

Header (all authenticated pages): product name, role navigation with the active item marked
`aria-current="page"`, the user's name and role badge, **Log out** button. Unauthenticated access to
any page redirects to `/login`; a page of the other role redirects to the user's home.

### 3.2 Shared UI Behavior

- **Forms:** visible `<label>` per field, required marker, client hints, server errors shown under the
  field (`aria-describedby`, `role="alert"` summary); submit button disabled while saving; values kept
  after an error.
- **Loading:** skeleton blocks with `aria-busy="true"`; never a blank page.
- **Empty:** short sentence + next action (e.g. "No available slots on this day. Try another date.", the F-04 text).
- **Error:** callout with the server `message` and a **Retry** button; 401 from any call → redirect to
  `/login` with "Your session has ended."
- **Confirmations:** accessible dialog (focus trap, Esc closes, focus returns) for Book and Cancel.
- **Dates/times:** displayed as `Mon 10 Nov 2026, 09:30` (Asia/Bangkok).
- **Responsive:** single column below 768 px, no horizontal page scroll at 320 px (NFR-08).

## 4. API Conventions

- Base path `/api`; JSON only; resources in plural nouns; actions that are not CRUD use a sub-path verb
  (`POST /api/bookings/:reference/cancel`).
- Bookings are addressed by their public `reference`, slots by numeric `id`.
- **Request validation** with `zod` schemas per route: unknown fields are stripped; identity fields
  (`customerId`, `staffId`, `role`, `userId`) are never read from the client (BR-08).
- **Success:** `200` (read/update), `201` (create), `204` (logout). Body is the resource or
  `{ <collection>: [...] }`.
- **Errors:** always `{ "error": "<CODE>", "message": "<human text>", "fields"?: { "<field>": "<text>" } }`.
- **Only exceptions (probe format, F-00 §3):** `GET /api/health` answers `200 { "status": "ok", "database": "up" }`
  or `503 { "status": "degraded", "database": "down" }`; `GET /api/ready` answers
  `200 { "status": "ready", "database": "connected" }` or `503 { "status": "not_ready" }`.

| Status | Codes |
| :--- | :--- |
| 400 | `BAD_REQUEST` (malformed JSON) |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN` (authenticated but wrong role) |
| 404 | `NOT_FOUND` (missing **or not owned** — BR-09) |
| 409 | `SLOT_ALREADY_BOOKED`, `SLOT_NOT_BOOKABLE`, `BOOKING_LIMIT_REACHED`, `BOOKING_OVERLAP`, `SLOT_OVERLAP`, `CANCELLATION_WINDOW_CLOSED`, `BOOKING_NOT_ACTIVE`; `SLOT_HAS_BOOKING` (Sprint 2), `OUTCOME_TOO_EARLY` (Sprint 2), `BOOKING_SUSPENDED` (Sprint 3) |
| 422 | `VALIDATION_ERROR` with `fields` |
| 503 | `GET /api/health` and `GET /api/ready` only (the exceptions above) |
| 500 | `INTERNAL_ERROR` — generic message, error logged server-side with a request id, no stack/SQL in the body (NFR-06) |

### 4.1 Endpoint Overview (Sprint 1)

| Method and path | Purpose | Roles |
| :--- | :--- | :--- |
| `GET /api/health` | Liveness + `SELECT 1` | public |
| `GET /api/ready` | Readiness for the post-deploy smoke test (`SELECT 1`), Lab 5 | public |
| `GET /api/version` | Running commit and Cloud Run revision `{ commit, revision }` (F-00 AC-39), Lab 5 | public |
| `POST /api/auth/login` | Log in | public |
| `POST /api/auth/logout` | Log out | any authenticated |
| `GET /api/auth/me` | Current user | any authenticated |
| `GET /api/services` | Active services | any authenticated |
| `POST /api/staff/slots` | Create own slot | Staff |
| `GET /api/staff/slots` | Own upcoming slots | Staff |
| `GET /api/staff/schedule?date=` | Own slots of one day with bookings | Staff |
| `GET /api/slots/available?date=&serviceId=` | Bookable slots | Customer |
| `POST /api/bookings` | Book a slot | Customer |
| `GET /api/bookings/mine` | Own bookings | Customer |
| `GET /api/bookings/:reference` | Own booking detail | Customer |
| `POST /api/bookings/:reference/cancel` | Cancel own booking | Customer |

## 5. Roles, Permissions and Ownership

Backend middleware: `requireAuth` (401) → `requireRole(...)` (403) → service-level ownership filter
(`where: { customerId: session.userId }` / `staffId`) returning 404 when not owned. **A hidden UI control
is never the protection.**

| Operation | Customer | Staff | Unauthenticated | Records accessible |
| :--- | :---: | :---: | :---: | :--- |
| Log in / health | ✔ | ✔ | ✔ | — |
| Log out, current user, list services | ✔ | ✔ | 401 | own identity; active services |
| Create slot | 403 | ✔ | 401 | slot is created for the session staff member only |
| List own slots / daily schedule | 403 | ✔ | 401 | own slots only, with the bookings on them |
| List bookable slots | ✔ | 403 | 401 | all bookable slots (no customer data) |
| Book a slot | ✔ | 403 | 401 | booking owned by the session customer |
| List / read own bookings | ✔ | 403 | 401 | own bookings only (others → 404) |
| Cancel own booking | ✔ | 403 | 401 | own active bookings only (others → 404) |
| *S2:* edit/close/cancel slot, record outcome | 403 | ✔ own slots | 401 | own slots only |
| *S2:* reschedule, view history | ✔ own | ✔ history of own slots | 401 | — |
| *S2–3:* manage services, dashboard, accounts | 403 | ✔ | 401 | all |

## 6. Authentication and Session

- **Credentials:** accounts are seeded; passwords hashed with **bcrypt, cost 12** (≥ 10, NFR-03); the
  hash column is excluded from every Prisma `select` used by the API.
- **Login:** `POST /api/auth/login` validates `{ email, password }`, looks up the active user by
  lower-cased e-mail and compares with `bcrypt.compare` (a dummy hash comparison is run when the user
  does not exist, to keep timing similar). Malformed input → 422 `VALIDATION_ERROR`; any credential failure
  (unknown e-mail, wrong password, inactive) → 401 `INVALID_CREDENTIALS` with the same message
  ("Email or password is incorrect."). Success → `req.session.regenerate()` (prevents session fixation),
  stores `{ userId }` only, returns the user.
- **Session:** `express-session` with `connect-pg-simple` (table `session`); cookie `sid`, `HttpOnly`,
  `SameSite=Lax`, `Secure` when `NODE_ENV=production`, `maxAge` 8 h, `rolling: true` (inactivity
  expiry). Secret from `SESSION_SECRET`. The options come from the pure function `sessionOptions(env)` in
  `server/src/config/session.ts` (unit-tested, UNIT-06).
- **Current user:** `requireAuth` loads the user by `session.userId` on every request; a missing or
  inactive user destroys the session and answers 401 `UNAUTHENTICATED` (BR-12). Role comes from the
  database row, not from the session or the client.
- **Logout:** `req.session.destroy()` + clear cookie → 204; the old cookie no longer authenticates.

## 7. Configuration, Secrets and Delivery Design

| Variable | Used by | Example in `.env.example` | Notes |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | server, Prisma | `postgresql://slotbook:change-me@localhost:5432/slotbook` | Test DB uses `DATABASE_URL_TEST`. |
| `DATABASE_URL_TEST` | server tests, E2E | `postgresql://slotbook:change-me@localhost:5432/slotbook_test` | Reset + seeded by the test setup. |
| `SESSION_SECRET` | server | `change-me-at-least-32-characters-long` | Production: ≥ 32 random chars and not the placeholder, or the server exits 1; Secret Manager in GCP. |
| `PORT` | server | `3000` | Cloud Run injects `PORT`. |
| `NODE_ENV` | server | `development` | `production` enables the `Secure` cookie, `trust proxy` and SPA serving; the seed then needs `SEED_DEMO_DATA=true`. |
| `SEED_PASSWORD` | seed | `change-me` | Password of every demo account; never printed; Secret Manager in GCP. |
| `SEED_DEMO_DATA` | seed | *(commented out)* | Production only: `true` lets the seed write the demo accounts (Lab 6 UAT), insert-only; demo slots and bookings only on an empty database. |
| `CLIENT_DIST` | server | *(commented out)* | Production only: built SPA folder; default `client/dist`. |
| `APP_COMMIT` | server | *(commented out)* | Commit returned by `GET /api/version`; set by `deploy/release.sh` on Cloud Run; default `local`. |

- `.env` files are git-ignored; only `.env.example` is committed. The client contains **no secret**
  (it only knows relative `/api` paths).
- **Durable storage:** all state is in PostgreSQL (including sessions), so app containers are stateless
  and replaceable.
- **Planned GCP deployment (Lab 5):** multi-stage **Dockerfile** (build client + server, run
  `node server/dist/index.js` serving API + SPA) → image in **Artifact Registry** → **Cloud Run** service
  (min 0, max 2 instances) → **Cloud SQL for PostgreSQL** via the Cloud SQL connector; `DATABASE_URL`
  and `SESSION_SECRET` from **Secret Manager**; migrations run by a one-off Cloud Run job
  (`prisma migrate deploy`) before each release. **GitHub Actions** CI: install → build → unit/API tests
  against a PostgreSQL service container → Playwright → deploy on `main`. `docker-compose.yml` (app +
  postgres) for local parity.

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-07 | Yanis Amrane | Baseline SDS for Deliverable 1, reviewed by Simeon Audouit. |
| 1.1 | 2026-11-07 | Yanis Amrane | Pre-PR review fixes (seed, health exception, S2/S3 codes, login 422, session options); see PR #9. |
| 1.2 | 2026-11-10 | Simeon Audouit | Decisions by Yanis Amrane for Issue #8: §3.2 empty-state example now matches the F-04 text; versions unified to "Node 20 or newer (tested with 20 and 24), PostgreSQL 16 or newer (tested with 16 and 18)". |
| 1.3 | 2026-11-11 | Yanis Amrane | Lab 5 (Issue #20): `GET /api/ready` in §4 (probe exception, 503, endpoint table); §7 variables follow the new `.env.example` (placeholders, `SEED_DEMO_DATA`, `CLIENT_DIST`, production seed opt-in, startup refusal). |
| 1.4 | 2026-11-14 | Simeon Audouit | Lab 5 (Issue #25): `GET /api/version` in §4.1; `APP_COMMIT` in §7. |
