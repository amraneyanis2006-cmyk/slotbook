# F-02 — Access Control and Ownership (Sprint 1 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | BR-08, BR-09, NFR-01, NFR-02, NFR-06 |
| Issue / owner / reviewer | Issue #3 (with F-01) — Yanis Amrane (author), Simeon Audouit (reviewer) |
| Depends on | F-01 |
| Contract version | 1.1 (2026-11-07) |

## 1. Behavior

- `requireAuth`: loads the session user from the database on every protected request; no session,
  unknown or inactive user → 401 `UNAUTHENTICATED` (session destroyed). Sets `req.user = { id, role, name, email }`.
- `requireRole(...roles)`: `req.user.role` not in the list → 403 `FORBIDDEN` "You do not have access to
  this operation." No data of the resource is read before the check.
- **Ownership** (BR-09) is applied inside the services by filtering on `req.user.id`
  (`customerId` / `staffId`); a record that exists but is not owned is answered exactly like a missing
  record: 404 `NOT_FOUND`.
- **Server-side identity** (BR-08): `zod` schemas strip unknown fields; services never accept
  `customerId`, `staffId`, `userId` or `role` from the request.
- **Error handler** (NFR-06): known `AppError`s → their status/code/message/fields; Prisma
  `P2002` on the booking index → 409 `SLOT_ALREADY_BOOKED` (used by F-04); anything else → 500
  `INTERNAL_ERROR` "Something went wrong. Please try again." with a request id; full error only in the
  server log.

## 2. Role/Permission Matrix (Sprint 1, binding for tests)

| Endpoint | No session | Customer | Staff |
| :--- | :---: | :---: | :---: |
| `GET /api/health`, `POST /api/auth/login` | 200 | 200 | 200 |
| `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/services` | 401 | ✔ | ✔ |
| `POST /api/staff/slots`, `GET /api/staff/slots`, `GET /api/staff/schedule` | 401 | 403 | ✔ (own) |
| `GET /api/slots/available`, `POST /api/bookings`, `GET /api/bookings/mine`, `GET /api/bookings/:reference`, `POST /api/bookings/:reference/cancel` | 401 | ✔ (own) | 403 |

`server/tests/api/access.api.test.ts` holds this matrix as a table (`PROTECTED_ROUTES`). **Every PR that
adds an endpoint adds its row to the table** (Issues #4–#7). Issue #3 creates the table with
`POST /api/auth/logout`, `GET /api/auth/me` and `GET /api/services`. API-07 role-restricted rows are added in
Issue #4 (staff endpoints) and Issue #5 (customer endpoints); API-08: slot part in Issue #4, booking part in
Issue #5.

### 2.1 API delivered by F-02

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/services` | — | `200 { "services": [ { "id": 1, "name": "Academic advising", "durationMin": 30 } ] }` (active services, ordered by name) | 401 |

## 3. UI

- `RequireRole` wrapper (F-01) for every page; a global fetch wrapper (`client/src/api/http.ts`)
  converts any 401 into "session ended" → `/login`, and shows 403/404/500 messages from the body.
- Navigation shows only the user's role items; this is **not** the authorization.

## 4. Data

No schema change.

## 5. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-06 | Every protected endpoint of the matrix, called without a session, returns 401 `UNAUTHENTICATED` and a body containing only `{ error, message }`. |
| AC-07 | Every role-restricted endpoint called with the other role returns 403 `FORBIDDEN` and no resource data. |
| AC-08 | Identity fields sent by the client (`customerId`, `staffId`, `role`, `userId` in body or query) are ignored: the created/returned records always belong to the session user. |
| AC-09 | An unexpected server error returns 500 `{ error: "INTERNAL_ERROR", message }` with no stack trace, SQL or file path. |
| AC-10 | UI: an unauthenticated visit to a protected page redirects to `/login`; a Customer opening `/staff/slots` (or a Staff member opening `/book`) is redirected to their own home. |

## 6. Failure / Boundary Cases

Tampered cookie (401), session of a deleted user (401), `role` in login body (ignored), 404 vs 403
distinction (role → 403, ownership → 404).
