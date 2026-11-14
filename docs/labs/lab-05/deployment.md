# SlotBook — Deployment (Lab 5)

Version 0.9 (2026-11-14, Issue #25: `deploy.yml` (§6), release procedure (§7), running commit (§8), rollback with `image_tag` (§9), `APP_COMMIT` / `K_REVISION` (§2); 0.8 2026-11-13, Issue #24: Workload Identity and merge gate in §11, project number redacted from the evidence and §4; 0.7 Issue #23: first deployment in §4 (source commit `main` `3845f83`), cost control in §10; 0.6 C-01 evidence recorded in §6; 0.5 Issue #22 fix: the CI e2e job migrates the test database before Playwright starts its web servers; 0.4 Issue #19; 0.3 Issue #22; 0.2 Issue #21; 0.1 Issue #20). Sections marked *To be filled* are completed by the later Lab 5 Issues
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
| `APP_COMMIT` | Commit (image tag) returned by `GET /api/version` and shown in the footer as "Release <7 chars>"; `local` when unset | No | Not set (`local`) | Not set | Set on every deploy by `deploy/release.sh` (`--update-env-vars APP_COMMIT=<image tag>`) |
| `K_REVISION` | Cloud Run revision name returned by `GET /api/version`; `null` when unset | No | Not set | Not set | Set by Cloud Run itself |
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
`artifacts/lab-05/screenshots/issue-19/`. The first deployment is below the resource table. Every name below
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
| Deployer service account | `slotbook-deployer` | Issue #24 (Workload Identity, §11) | used by GitHub Actions only; no JSON key |

**First deployment (Issue #23, guide Episode 5), 2026-11-13, run by Yanis Amrane (project owner) from Cloud Shell
in project `cpe334-slotbook-y`; source: fresh clone of `main` at `3845f83` = Lab 5 Release 1 (Merge pull request #32),
checked with `git log --oneline -1` before the dry run, nothing changed before `deploy.sh` ran:**

| Step | Command | Result | Evidence |
| :--- | :--- | :--- | :--- |
| Preview | `PROJECT_ID=cpe334-slotbook-y DRY_RUN=1 ./deploy/deploy.sh --demo` | exit 0, 28 commands printed, no gcloud call | `artifacts/lab-05/deploy/deploy-dry-run.txt`, `artifacts/lab-05/screenshots/issue-23/1-dry-run.jpg` |
| Deploy | `./deploy/deploy.sh --demo` | `DEPLOY_EXIT=0`: Cloud Build image `slotbook:latest`, job execution `slotbook-migrate-8ccgl` succeeded (migrations + demo seed), revision **`slotbook-00001-jcd`** serving 100 % of traffic | `artifacts/lab-05/deploy/deploy-first-run.txt` |
| Smoke test | `python3 deploy/smoke_test.py https://slotbook-mivepbjoza-as.a.run.app` | 4 PASS (`/api/health`, `/api/ready`, `/`, `/api/services` 401), sign-in SKIP (no smoke credentials), `SMOKE_EXIT=0` | `artifacts/lab-05/deploy/smoke-first-deploy.txt`, `artifacts/lab-05/screenshots/issue-23/3-smoke-test.jpg` |

**Service URL: https://slotbook-mivepbjoza-as.a.run.app**. The first image
is tagged `latest` by `deploy.sh`; from Issue #25 on, `deploy.yml` deploys images tagged with the full commit SHA.
In the logs, the project number is replaced by `<PROJECT_NUMBER>` (§11), user e-mails in the printed IAM policy by `<owner>` / `<teammate>`, and the database password
by `<REDACTED>` (by `deploy.sh` itself); no secret value appears.

`DRY_RUN=1` without `PROJECT_ID` prints the placeholder project `example-gcp-project` **by design**: a dry run never
calls `gcloud`, not even to read the active project. Set `PROJECT_ID` to preview the real names.

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

**C-01 evidence (R-05):** run [43270720258](https://github.com/amraneyanis2006-cmyk/slotbook/actions/runs/43270720258)
of PR #30 into `staging`, head commit `7ea5930` (the Docker image is tagged with the PR merge ref
`bb6cf82063ed92d05842dadd928f75aa4c084df8`, which is GitHub's `github.sha` for pull requests). Both jobs green:
`test-and-docker` (deploy scripts 7 stub + 5 release checks and 6 smoke tests, server 13 files / 63 tests, client
4 files / 7 tests, build, Docker build) and `e2e` (Playwright 9 passed). Its `ci-output` artifact, unchanged, is in
`artifacts/lab-05/test-output/ci-c01/`. The earlier run 43269454819 (PR #29) had `test-and-docker` green but `e2e`
failed (no test database before Playwright's web servers), fixed in PR #30.

**Deploy workflow `.github/workflows/deploy.yml`** (Issue #25, adapted from the kit; name *Deploy demo*): on push to
`main` and `workflow_dispatch` (input `image_tag` for a rollback). Job `test` reuses this CI workflow; job `deploy`
runs only after it passed (or for a rollback, where `test` is skipped). Same pinned action SHAs as the kit
(checkout v7.0.1, google-github-actions/auth v3, setup-gcloud v3.0.1, setup-python v7.1.0). Stages: §7. Changes from
the kit: `slotbook` names; the summary also shows the revision; `image_tag=latest` is accepted for a rollback only
(the Release 1 image has no SHA tag); `release.sh` also sets `APP_COMMIT`.

## 7. Release procedure

Every release reaches the live service the same way (R-07); nobody types a deploy command.

1. **Issue** titled `Lab 5 #<step> - <title>` (or a feature/fix Issue), label `lab5` for Lab 5 work, on the board.
2. **Branch** from `staging`: `<type>/<issue>-<slug>` (for example `ci/25-deploy-pipeline`).
3. **PR into `staging`**, label, "Closes #<n>". CI (`ci-docker.yml`) runs `test-and-docker` (deploy-script tests,
   server and client tests, build, Docker build) and `e2e`. The teammate (not the author) approves with a specific
   check or finding; `protect-staging` blocks the merge until `test-and-docker` is green, the branch is up to date
   and 1 approval exists (§11). Merge commit.
4. **Release PR `staging` → `main`** titled `Lab 5 Release <n> - …`, listing the PRs it contains. Same CI, same
   gate (`protect-main`), teammate approval, merge commit. Every merge into `main` is a release.
5. **`deploy.yml` (Deploy demo)** starts on the push to `main`:
   `test` (reuses `ci-docker.yml`, job `test-and-docker`) → `deploy` (environment `demo`, keyless sign-in as
   `slotbook-deployer`) → `docker build` **on the runner** and `docker push`
   `asia-southeast1-docker.pkg.dev/cpe334-slotbook-y/slotbook/slotbook:<full commit SHA>` (no Cloud Build: the deployer
   has no Cloud Build role; the `latest` tag is never pushed) → `deploy/release.sh`: resolve the tag to its
   `@sha256` digest, update and run the job `slotbook-migrate` with `--wait` (a failed migration stops the release
   before the service changes), update the service `slotbook` to the same digest with `APP_COMMIT=<SHA>`, 100 %
   traffic to the new revision → `deploy/smoke_test.py` on the public URL → run summary (image tag, digest,
   revision, URL).
6. **Check:** the run is green, its Summary shows the merged commit, and §8 shows the same SHA on the live URL.

If a deploy step fails, read the failed step's log first (guide Episode 7 table); after fixing a setup problem
(not code), use *Re-run all jobs*. Concurrency group `deploy-demo` queues releases and never cancels a running one.
`deploy.yml` never passes `--allow-unauthenticated` and changes no IAM: the service is public since Issue #23.

## 8. How to find the running commit

| Where | What it shows |
| :--- | :--- |
| Footer of every page on the public URL | `Release <first 7 characters of the commit>` (no line = an image older than Issue #25, for example `latest`) |
| `curl -s https://slotbook-mivepbjoza-as.a.run.app/api/version` | `{ "commit": "<full SHA or latest>", "revision": "<Cloud Run revision>" }` (public, no session) |
| Actions → Deploy demo → run → Summary | commit image tag, digest, revision, URL |
| Cloud Run → `slotbook` → Revisions | the revision with 100 % traffic; its image digest and its variable `APP_COMMIT` |
| Artifact Registry → `slotbook` → `slotbook` | the image tagged with the same full SHA and digest |
| `gcloud run services describe slotbook --region asia-southeast1 --format='value(status.latestReadyRevisionName,spec.template.spec.containers[0].image)'` | read-only: serving revision and image digest |

## 9. Rollback

Actions → **Deploy demo** → **Run workflow** → branch `main` → `image_tag` = the full 40-character SHA of an image
that already exists (copy "Commit image tag" from an earlier green run's Summary), or `latest` for the Release 1
image built by `deploy.sh` (it has no SHA tag; `latest` is accepted **only** for a rollback, never for a normal
release). Same from a terminal: `gh workflow run deploy.yml --ref main -f image_tag=<tag>`. The `test` job and
the build are skipped, `release.sh` skips the migration, resolves the tag to its digest and updates the service
(`APP_COMMIT=<tag>`), then the smoke test runs. To roll forward, run it again with the newer release's SHA (an empty
`image_tag` tests, rebuilds and deploys current `main` instead). A rollback changes only the image, never the
database: migrations stay additive (expand, then contract). List the available tags (read-only):
`gcloud artifacts docker images list asia-southeast1-docker.pkg.dev/cpe334-slotbook-y/slotbook/slotbook --include-tags`.
The persistence check, rollback and roll-forward evidence (Issue #26) will be recorded here.

## 10. Cost control

Settings that keep the cost low (they apply from the first deployment, Issue #23):

| What | Setting | Where |
| :--- | :--- | :--- |
| Cloud SQL `slotbook-pg` | smallest tier `db-f1-micro` (`--edition=enterprise`), 10 GB SSD, **storage auto-increase off** (`--no-storage-auto-increase`) | `deploy/deploy.sh` step 3 |
| Cloud Run `slotbook` | **min 0 / max 2** instances (no instance runs when nobody uses the app), 1 CPU, 512 MiB | step 11 |
| Cloud Run job `slotbook-migrate` | runs only during a deployment (max 1 retry, 300 s timeout) | step 10 |
| Budget `CPE334-Alert` | alerts only (no cap): **1,700 THB ≈ USD 50**, 12 Nov – 15 Dec 2026, e-mail at 10 / 20 / 50 / 90 % of actual cost, project `cpe334-slotbook-y` only | Billing (Issue #19) |
| Credit | GCP Free Trial, USD 300 (10,132.96 THB), until 11 Feb 2027; nobody clicks Upgrade or pays a prepayment | Billing (Issue #19) |

Cloud SQL is billed for every hour it exists, even when the app is idle: pause it when not needed and tear everything
down after the course (`deploy/teardown.sh`, guide Episodes 9 and 10; to be documented when used).

## 11. Workload Identity and merge gate

Issue #24, guide Episode 6. The GCP part was run by Yanis Amrane (project owner) in Cloud Shell on 2026-11-13
(`artifacts/lab-05/deploy/wif-setup.sh`, output `wif-setup.txt`). The GitHub part (environment and rulesets) was set
with `gh api` by the coding agent at the owner's request. In this file and in the evidence the project number is
written `<PROJECT_NUMBER>`.

**Deployer service account `slotbook-deployer`** (GitHub Actions only). It has 0 user-managed keys: GitHub gets a
short-lived token through Workload Identity Federation, so no JSON key exists to leak.

| Role | Granted on | Why |
| :--- | :--- | :--- |
| `roles/run.developer` | project `cpe334-slotbook-y` | deploy new revisions of the `slotbook` service and update/execute the `slotbook-migrate` job; it cannot change IAM. Project-wide, so it could deploy any Cloud Run service in this project (the project holds only SlotBook) |
| `roles/artifactregistry.writer` | repository `slotbook` only | push the image built by `deploy.yml`; no access to other repositories |
| `roles/iam.serviceAccountUser` | service account `slotbook-runner` only | deploy the service and job *as* `slotbook-runner` (the runtime identity that reads the secrets); it cannot act as any other service account |

The deployer has no Secret Manager or Cloud SQL role: the secrets are read at run time by `slotbook-runner`, not by
the deployer. It also has no Cloud Build role and cannot change the service's IAM policy, so `deploy.yml` (Issue #25)
builds and pushes the image with `docker` on the runner and does not pass `--allow-unauthenticated` (the service is
already public since Issue #23), unlike `deploy/deploy.sh`.

**Pool and provider:** pool `github-actions` (global), OIDC provider `github-main`, state ACTIVE, issuer
`https://token.actions.githubusercontent.com/`, attribute mapping `google.subject=assertion.sub`,
`attribute.repository_id=assertion.repository_id`. Full name (the value of `WIF_PROVIDER`):
`projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-actions/providers/github-main`.

**Attribute condition** (Google rejects every token that does not match it):

```
assertion.repository_id == '1449165803'
&& assertion.repository_owner_id == '281914725'
&& assertion.ref == 'refs/heads/main'
&& assertion.workflow_ref == 'amraneyanis2006-cmyk/slotbook/.github/workflows/deploy.yml@refs/heads/main'
&& (assertion.sub == 'repo:amraneyanis2006-cmyk@281914725/slotbook@1449165803:environment:demo'
    || assertion.sub == 'repo:amraneyanis2006-cmyk/slotbook:environment:demo')
```

- The numeric repository and owner IDs do not change if the repository or account is renamed, so a new repository
  that reuses the name cannot match.
- Only `deploy.yml` running on `main` in the `demo` environment can get a token: a pull request, another branch or
  another workflow cannot.
- Both subject formats are accepted: GitHub's immutable format (with IDs) and the classic one.

`roles/iam.workloadIdentityUser` on `slotbook-deployer` is granted to
`principalSet://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-actions/attribute.repository_id/1449165803`
(this repository only).

**GitHub environment `demo`:**
- Deployment branches: **selected branches, only `main`**.
- No required reviewer and no wait timer.
- 4 environment **variables** (not secrets, because none of them is a credential): `GCP_PROJECT_ID`, `GCP_REGION`,
  `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`.
- No environment secrets.

**Branch rulesets (merge gate, R-06):** `protect-main` (target `main`) and `protect-staging` (target `staging`), both
**Active** with an **empty bypass list**, so they apply to the repository admin too.

| Rule | Setting |
| :--- | :--- |
| Restrict deletions | on |
| Block force pushes | on |
| Require a pull request before merging | 1 required approval; merge commit, squash and rebase allowed (the team uses merge commits); GitHub's default `require_extra_approval_for_unattributed_changes: true` kept |
| Require status checks to pass | required check **`test-and-docker`** from GitHub Actions (integration id 15368), "Require branches to be up to date before merging" on |

The job id `test-and-docker` in `.github/workflows/ci-docker.yml` must not be renamed: a renamed job would never
report the required check, and every merge would be blocked. The optional `e2e` job is not required.

**Project number in public files:** the evidence and this file write it as `<PROJECT_NUMBER>` (Issue #24 also redacted
it in `artifacts/lab-05/deploy/deploy-first-run.txt` and removed the deterministic Cloud Run URL from §4). The number
is an identifier, not a credential: it grants no access, which is controlled by IAM and the attribute condition above.
Commits made before this redaction (Issue #23, PR #33) still contain it, because history is never rewritten (R-10). It
also appears in the `WIF_PROVIDER` environment variable, which is not committed but may be printed in Actions logs.

*Still to do in Issue #24: C-02, a pull request with a failing test that the gate must block (Simeon Audouit).*
