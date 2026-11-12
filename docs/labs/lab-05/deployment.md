# SlotBook — Deployment (Lab 5)

Version 0.2 (2026-11-12, Issue #21; 0.1 Issue #20). Sections marked *To be filled* are completed by the later Lab 5 Issues
(#21–#26). No secret value appears in this file: only variable names and where their values come from.

## 1. Stack and differences from the reference kit

| Part | SlotBook | Reference kit (TokTickIT) |
| :--- | :--- | :--- |
| Runtime | Node 20 or newer (`engines` ≥ 20.12), Express 4, TypeScript | Node, Express |
| Database | PostgreSQL 16, Prisma 5 migrations in `server/prisma/migrations` | PostgreSQL, Prisma |
| Sessions | In PostgreSQL (`session` table) via `connect-pg-simple`; nothing kept in server memory | In the database |
| UI | React + Vite SPA, built to `client/dist` | React SPA |
| Container | **One image** (`Dockerfile`, `node:22-bookworm-slim`): in production Express serves the API under `/api` and the built SPA, with `index.html` for every other GET route (`CLIENT_DIST`) | One container for UI and API |
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
| `CLIENT_DIST` | Production only: folder of the built SPA | No | Default `client/dist` | Not needed | Not set: the image puts the SPA at `/app/client/dist`, the default |
| `POSTGRES_PASSWORD` | Docker Compose only: password of the `slotbook` role in the compose database | Yes (local) | `.env` | Not needed | Not used (Cloud SQL) |

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

**Image** (`Dockerfile`, two stages, build from the repository root):

- *build* (`node:22-bookworm-slim` + `openssl`): `npm ci` for server (its postinstall runs `prisma generate` and
  downloads the engines `prisma migrate deploy` needs) and client, `npm run build` for both, then
  `npm prune --omit=dev` in `server/`.
- *runtime* (`node:22-bookworm-slim` + `openssl`, `ca-certificates`): `server/` with production `node_modules`,
  `dist/`, `prisma/` and `src/` (the seed imports it), and the SPA in `/app/client/dist`; `NODE_ENV=production`,
  `PORT=3000`, runs as the unprivileged `node` user, `CMD ["node", "dist/index.js"]` (the server only).
- glibc (bookworm), not the kit's alpine: bcrypt's prebuilt binary and Prisma's engines target glibc; Node 22
  instead of the kit's 24 (SlotBook is tested on 20–24, 22 is the current LTS line).
- `prisma` and `tsx` are runtime dependencies of `server/` because the migrate/seed job runs
  `npx prisma migrate deploy && npm run db:seed` (`tsx prisma/seed.ts`) from this image; `npm start` and the
  root scripts keep `node --env-file=../.env` for local runs, the image never uses them.
- `.dockerignore` keeps `node_modules`, `dist`, every `.env*`, `.git`, `artifacts/` and test reports out of the
  build context, so no local secret can enter an image layer.

**Why not the kit's `client/Dockerfile`, `server/Dockerfile`, `client/nginx.conf` and `docker-entrypoint.sh`:**
Express already serves the built SPA with the `index.html` fallback (F-00 §3, API-27), so the same single image
runs locally and on Cloud Run; a second nginx container would add a second origin (CORS, cookies) and a config
that Cloud Run never runs. The kit's entrypoint script only did `exec "$@"`; with `CMD` in exec form the base
image's entrypoint already execs `node`, so `node` is PID 1. Because PID 1 gets no default action for SIGTERM,
`server/src/index.ts` handles it: it closes the server and exits 0 (UNIT-08), so Cloud Run and `docker stop` do not
wait for the grace period and then kill it.

The kit sets `TZ=Asia/Bangkok`; SlotBook does not: it stores UTC and converts with explicit Asia/Bangkok helpers
(NFR-10), so the container time zone does not matter.

**Local run with Docker Compose** (`docker-compose.yml`: `db` = `postgres:16` with the named volume `pgdata`;
`migrate` = one-off `npx prisma migrate deploy && npm run db:seed` with `SEED_DEMO_DATA=true`, the same command as
the Cloud Run job; `app` on `127.0.0.1:3000` after `migrate` succeeded). Every value comes from `.env`; compose
builds `DATABASE_URL` with the `db` host from `POSTGRES_PASSWORD`, sets `NODE_ENV=production`, and passes each
service only what it needs (`migrate`: `SEED_PASSWORD`; `app`: `SESSION_SECRET`). `app` has a healthcheck on
`/api/ready`. `POSTGRES_PASSWORD` is applied only when the `pgdata` volume is first created: after changing it, run
`docker compose down -v` (deletes the local data) or the app gets "authentication failed".

```bash
cp .env.example .env                  # replace every change-me; SESSION_SECRET ≥ 32 characters
docker compose up --build -d
curl -s http://localhost:3000/api/ready   # {"status":"ready","database":"connected"}
docker compose logs migrate           # migration + seed counts (never the password)
docker compose down                   # keeps the data volume; `down -v` deletes it
```

The app runs in production mode: the server sends its Secure session cookie only over HTTPS (`X-Forwarded-Proto:
https` from Cloud Run's proxy), not over plain `http://localhost`, so logging in through the UI needs Cloud Run. The C-03 check
(`artifacts/lab-05/c03-fresh-clone.txt`) logs in through the API with `X-Forwarded-Proto: https`, as Cloud Run's
proxy does.

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
