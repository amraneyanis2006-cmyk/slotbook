# SlotBook — Deployment (Lab 5)

Version 0.1 (2026-11-11, Issue #20). Sections marked *To be filled* are completed by the later Lab 5 Issues
(#21–#26). No secret value appears in this file: only variable names and where their values come from.

## 1. Stack and differences from the reference kit

| Part | SlotBook | Reference kit (TokTickIT) |
| :--- | :--- | :--- |
| Runtime | Node 20 or newer (`engines` ≥ 20.12), Express 4, TypeScript | Node, Express |
| Database | PostgreSQL 16, Prisma 5 migrations in `server/prisma/migrations` | PostgreSQL, Prisma |
| Sessions | In PostgreSQL (`session` table) via `connect-pg-simple`; nothing kept in server memory | In the database |
| UI | React + Vite SPA, built to `client/dist` | React SPA |
| Container | **One container**: in production Express serves the API under `/api` and the built SPA, with `index.html` for every other GET route (`CLIENT_DIST`) | One container for UI and API |
| Uploads | None (SlotBook stores no file) | Files as bytes in the database |
| Readiness | `GET /api/ready` (200 / 503 after `SELECT 1`); `GET /api/health` kept from Sprint 1 | `GET /api/ready` |
| Demo data | Seed writes demo accounts in production only with `SEED_DEMO_DATA=true` and `SEED_PASSWORD`, insert-only (safe on every release) | `ADMIN_PASSWORD`, `SEED_DEMO_DATA`, `DEMO_USER_PASSWORD` |

Kit variables SlotBook does not use: `ADMIN_PASSWORD`, `DEMO_USER_PASSWORD` (one `SEED_PASSWORD` for every demo
account), `CORS_ORIGIN` (UI and API share one origin), `ALLOW_LEGACY_REQUESTER_HEADER` (no such shortcut).

## 2. Environment variables

The client reads none (`import.meta.env` is not used). Every variable below is listed in `.env.example` with a
placeholder. "Secret" values never go in the repository, a log, a screenshot or a PR.

| Name | Purpose | Secret | Local | CI | Cloud Run |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection of the app, migrations and seed | **Yes** | `.env` (your local role password) | Throw-away CI database, set in the workflow | Secret Manager `slotbook-database-url` |
| `DATABASE_URL_TEST` | Test database (name ends in `_test`), reset by the test setup | Yes (local) | `.env` | Throw-away CI database | Not set |
| `SESSION_SECRET` | Signs the session cookie; ≥ 32 characters in production or the server exits 1 | **Yes** | `.env` | Generated test value in the workflow | Secret Manager `slotbook-session-secret` |
| `PORT` | HTTP port | No | `.env` (3000) | Workflow (3000) | Set by Cloud Run |
| `NODE_ENV` | `development` / `test` / `production` (production: Secure cookie, trust proxy, SPA serving, seed opt-in) | No | `.env` (`development`) | `test` (set by Vitest/Playwright) | `production` (service and job config) |
| `SEED_PASSWORD` | Password of every seeded demo account; never printed | **Yes** | `.env` | Generated test value in the workflow | Secret Manager `slotbook-seed-password` (migration/seed job) |
| `SEED_DEMO_DATA` | Production only: `true` lets the seed write demo accounts | No | Not needed | Not needed | `true` on the migration job (every release). Insert-only: creates missing services/users, demo slots and bookings only on an empty database, never changes an existing row; prints counts |
| `CLIENT_DIST` | Production only: folder of the built SPA | No | Default `client/dist` | Not needed | Image path, set in Issue #21 if it differs |

## 3. Local commands

From the repository root (details in the [README](../../../README.md)):

```bash
cp .env.example .env          # then replace every change-me
npm run install:all           # root + server + client, generates the Prisma client
npm run db:migrate            # apply migrations to DATABASE_URL
npm run db:seed               # idempotent demo data (password from SEED_PASSWORD)
npm test                      # server + client tests (slotbook_test only)
npm run test:e2e              # Playwright end-to-end tests
npm run build                 # server/dist and client/dist
npm run dev                   # API :3000 + Vite :5173 (development)
```

Run as in production, one process serving API and SPA (after `npm run build`; `SESSION_SECRET` ≥ 32 characters):

```bash
NODE_ENV=production npm start --prefix server   # http://localhost:3000 ; /api/ready shows the database state
```

This only checks SPA serving and `/api/ready`: over plain `http://localhost` the Secure session cookie is not sent,
so logging in needs HTTPS or a proxy that sets `X-Forwarded-Proto: https` (Cloud Run does).

## 4. GCP project and resources

*To be filled in Issues #19 and #23.* Planned names: region `asia-southeast1`, Artifact Registry `slotbook`, image
`slotbook`, Cloud SQL `slotbook-pg` (PostgreSQL 16), database and user `slotbook`, Cloud Run service `slotbook`,
migration job `slotbook-migrate`, service accounts `slotbook-runner` and `slotbook-deployer`.

## 5. Docker

*To be filled in Issue #21.* Known points for the image: `npm start` and `npm run prisma` use
`node --env-file=../.env`, which fails when the file is missing (Cloud Run has none); the seed runs through `tsx`
(a devDependency) and `prisma/seed.ts` is outside the `tsc` build.

## 6. CI

*To be filled in Issue #22* (required check `test-and-docker`).

## 7. Release procedure

*To be filled in Issues #24 and #25.*

## 8. How to find the running commit

*To be filled in Issue #25.*

## 9. Rollback

*To be filled in Issue #26.*

## 10. Cost control

*To be filled in Issues #19 and #23* (budget alert, Cloud Run min 0 / max 2, smallest Cloud SQL tier, pause when idle).
