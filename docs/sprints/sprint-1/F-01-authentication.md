# F-01 — Authentication and Session (Sprint 1 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-01, FR-02, FR-03, FR-04, BR-12, NFR-03, NFR-05 |
| Issue / owner / reviewer | Issue #3 (with F-02) — Yanis Amrane (author), Simeon Audouit (reviewer) |
| Depends on | F-00 |
| Contract version | 1.1 (2026-11-07) |

## 1. Behavior and Workflow

1. The user opens any page; without a session the SPA calls `GET /api/auth/me` (401) and shows `/login`.
2. The user submits e-mail + password. The server validates the input, finds an **active** user by
   lower-cased e-mail and compares the bcrypt hash.
3. Success: the session is regenerated, `{ userId }` stored, the user returned; the SPA redirects to the
   role home (Customer → `/book`, Staff → `/staff/slots`) and shows name + role in the header.
4. Failure (unknown e-mail, wrong password, inactive account): one generic 401 message; the form keeps
   the e-mail, clears the password and shows the error.
5. **Log out** destroys the server session and clears the cookie; the SPA returns to `/login`. Any later
   request with the old cookie is 401.

## 2. Business Rules and Validation

- BR-12: inactive accounts cannot log in; a session whose user became inactive is rejected (401) and destroyed.
- Validation: `email` required, valid e-mail format, ≤ 254 chars; `password` required, 1–128 chars.
  Invalid shape → 422 `VALIDATION_ERROR` with `fields`.
- No account lock-out in Sprint 1 (documented limitation).
- Session cookie options (`HttpOnly`, `SameSite=Lax`, `Secure` in production, `maxAge` 8 h, `rolling`) come from the
  pure function `sessionOptions(env)` in `server/src/config/session.ts` (UNIT-06).

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `POST /api/auth/login` | `{ "email": "cust.ploy@slotbook.test", "password": "…" }` | `200 { "user": { "id": 3, "name": "Ploy Chai", "email": "cust.ploy@slotbook.test", "role": "CUSTOMER" } }` + `Set-Cookie: sid=…; HttpOnly; SameSite=Lax; Path=/` | 422 `VALIDATION_ERROR`; 401 `INVALID_CREDENTIALS` "Email or password is incorrect." |
| `POST /api/auth/logout` | — | `204` (cookie cleared) | 401 `UNAUTHENTICATED` |
| `GET /api/auth/me` | — | `200 { "user": { id, name, email, role } }` | 401 `UNAUTHENTICATED` "Please log in." |

The `user` object never contains `passwordHash` or `isActive`.

## 4. UI

- `/login`: e-mail and password fields with labels, **Log in** button (disabled while submitting),
  error callout `role="alert"`; already-authenticated users are redirected to their home.
- `AuthProvider` (React context) holds the current user from `/api/auth/me`; header shows name, role
  badge and **Log out**.
- `RequireRole` route wrapper: no user → `/login`; wrong role → own home. This is navigation comfort;
  authorization is F-02 on the server.

## 5. Data

No schema change (uses `User` and `session` from F-00).

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-01 | Valid credentials of an active user → 200 with `{ user: { id, name, email, role } }` and an `HttpOnly`, `SameSite=Lax` session cookie (`Secure` in production, 8 h rolling expiry); the body contains no `passwordHash`. |
| AC-02 | Wrong password, unknown e-mail and inactive account each → 401 `INVALID_CREDENTIALS` with the **same** message; no cookie that authenticates is issued. |
| AC-03 | `GET /api/auth/me` with a valid session → 200 with the current user; without a session → 401 `UNAUTHENTICATED`. |
| AC-04 | After `POST /api/auth/logout` (204), the old cookie gets 401 on `/api/auth/me` and on a protected endpoint. |
| AC-05 | UI: a Customer logs in and lands on `/book`, a Staff member on `/staff/slots`; the header shows the name and role; wrong credentials show the error without leaving the page; **Log out** returns to `/login`. |

## 7. Failure / Boundary Cases

Empty fields (422), e-mail with upper-case letters (accepted, normalised), password of 129 chars (422),
deactivated user with an existing session (401 on next request), double logout (second is 401).
