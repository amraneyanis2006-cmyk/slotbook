# SlotBook — Deployment (Lab 5)

Version 0.5 (2026-11-13, Issue #22 fix: the CI e2e job migrates the test database before Playwright starts its web servers; 0.4 Issue #19; 0.3 Issue #22; 0.2 Issue #21; 0.1 Issue #20). Sections marked *To be filled* are completed by the later Lab 5 Issues
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
| `DATABASE_URL` | PostgreSQL connection of the app, migrations and seed | **Yes** | `.env` (your local role password) | Throw-away CI database (`ci-docker.yml` env) | Secret Manager `slotbook-database-url` |
| `DATABASE_URL_TEST` | Test database (name ends in `_test`), reset by the test setup | Yes (local) | `.env` | Throw-away CI database | Not set |
| `SESSION_SECRET` | Signs the session cookie; ≥ 32 characters in production or the server exits 1 | **Yes** | `.env` | Fixed throw-away value in `ci-docker.yml` | Secret Manager `slotbook-session-secret` |
| `PORT` | HTTP port | No | `.env` (3000) | From the copied `.env.example` (3000) | Set by Cloud Run |
| `NODE_ENV` | `development` / `test` / `production` (production: Secure cookie, trust proxy, SPA serving, seed opt-in) | No | `.env` (`development`) | `test` (set by Vitest/Playwright) | `production` (service and job config) |
| `SEED_PASSWORD` | Password of every seeded demo account; never printed | **Yes** | `.env` | Fixed throw-away value in `ci-docker.yml` | Secret Manager `slotbook-seed-password` (migration/seed job) |
| `SEED_DEMO_DATA` | Production only: `true` lets the seed write demo accounts | No | Not needed | Not needed | `true` on the migration job only if `deploy/deploy.sh --demo` was used (Lab 6 UAT); every release keeps it. Insert-only: creates missing services/users, demo slots and bookings only on an empty database, never changes an existing row; prints counts |
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

**Project (Issue #19, guide Episode 1):** project ID `cpe334-slotbook-y` (name "CPE334 SlotBook"), region
`asia-southeast1` for every resource, linked to the GCP Free Trial billing account (USD 300 credit, until
11 Feb 2027). Budget **`CPE334-Alert`**: alerts only (no spending cap), 1,700 THB ≈ USD 50, 12 Nov – 15 Dec 2026,
this project only, e-mail alerts at 10 / 20 / 50 / 90 % of **actual** cost. The teammate has the basic role
**Writer** (`roles/writer`, the new name of the basic role Editor); the project owner keeps Owner. Evidence:
`artifacts/lab-05/screenshots/issue-19/`. The first deployment is *to be filled in Issue #23*. Every name below
is set once in `deploy/deploy.sh` and reused by `deploy/release.sh`, `deploy/teardown.sh` and the offline tests.
`deploy/deploy.sh` creates billing-relevant resources, IAM bindings, Cloud SQL and secrets, so **a human runs it from
Cloud Shell** (Issue #23), first with `DRY_RUN=1`; the coding agent never runs it.

| Resource | Name | Created by | Notes |
| :--- | :--- | :--- | :--- |
| Artifact Registry (Docker) | `slotbook`, image `slotbook` | `deploy.sh` step 2 | `asia-southeast1-docker.pkg.dev/<project>/slotbook/slotbook:<tag>`; deploy.yml tags with the full commit SHA (Issue #25) |
| Cloud SQL for PostgreSQL | `slotbook-pg` | step 3 | `POSTGRES_16`, `db-f1-micro`, `--edition=enterprise`, 10 GB SSD, `--no-storage-auto-increase` |
| Database and user | `slotbook` / `slotbook` | steps 4, 6 | password generated, stored only inside the `slotbook-database-url` secret |
| Runtime service account | `slotbook-runner` | step 5 | `roles/cloudsql.client` on the project; `secretAccessor` on each of the three secrets only |
| Secret `slotbook-database-url` | `DATABASE_URL` | step 6 | Cloud SQL unix socket URL; read by the service and the job |
| Secret `slotbook-session-secret` | `SESSION_SECRET` | step 7 | 48 random hex characters; mounted in the service only |
| Secret `slotbook-seed-password` | `SEED_PASSWORD` | step 8 | password of the demo accounts; mounted in the migration job only (`--set-secrets`). The service and the job share `slotbook-runner`, which can read all three secrets |
| Cloud Run job | `slotbook-migrate` | step 10 | `sh -c "npx prisma migrate deploy && npm run db:seed"`, `NODE_ENV=production`, `SEED_DEMO_DATA=true` with `--demo`; runs before every service update |
| Cloud Run service | `slotbook` | step 11 | public, `--port 3000`, min 0 / max 2 instances, 512 MiB, `NODE_ENV=production` |
| Deployer service account | `slotbook-deployer` | Issue #24 (Workload Identity) | used by GitHub Actions only; no JSON key |

Read a secret when needed (never paste it anywhere): `gcloud secrets versions access latest --secret=slotbook-seed-password`.
Changes from the kit: `slotbook*` names; session and seed secrets instead of the kit's admin/demo passwords; storage
auto-increase off; max 2 instances; no `TZ` variable.

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

Workflow `.github/workflows/ci-docker.yml` (adapted from the kit), on every pull request into `staging` or `main`, and
reusable (`workflow_call`) by the deploy workflow (Issue #25). Read-only `contents: read`; actions pinned to full commit
SHAs (checkout v7.0.1, setup-node v7.1.0, setup-python v7.1.0 from the kit; upload-artifact v7.0.2 added); Dependabot
(`.github/dependabot.yml`) proposes their updates weekly. Every step runs with `bash -eo pipefail`, so a failure is
never hidden by `| tee`.

**Job `test-and-docker`** (the required check, Issue #24; do not rename): PostgreSQL 16 service with throw-away CI
values (not secrets) → Node 22 + Python 3.14 → deploy scripts offline (`bash -n` on each script, `deploy/tests/test_deploy_stub.sh` incl. a teardown dry run,
`test_release_stub.sh`, `test_smoke.py`; no GCP access) → `cp .env.example .env` (the npm scripts read it; the job's
env vars win) → `npm run install:all` → migrate + seed the test database → server tests → client tests →
`npm run build` → `docker build` of the production image (not pushed). Outputs are uploaded as the `ci-output`
artifact (`deploy-scripts.txt`, `server-tests.txt`, `client-tests.txt`, `build.txt`, `docker-build.txt`).

**Job `e2e`** (optional, not a required check, pull requests only, so it never gates a deploy): Playwright with
Chromium against the dev servers; the report is uploaded when it fails.

Run the same deploy-script checks locally: `bash deploy/tests/test_deploy_stub.sh && bash deploy/tests/test_release_stub.sh && python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'`.
Smoke test of a deployment (read-only): `python3 deploy/smoke_test.py <URL>`, optionally with `SMOKE_EMAIL` and
`SMOKE_PASSWORD` for the sign-in check.

## 7. Release procedure

*To be filled in Issues #24 and #25.*

## 8. How to find the running commit

*To be filled in Issue #25.*

## 9. Rollback

*To be filled in Issue #26.*

## 10. Cost control

*To be filled in Issues #19 and #23* (budget alert, Cloud Run min 0 / max 2, smallest Cloud SQL tier, pause when idle).
