# SlotBook

Appointment booking for a university Student Service Center: staff publish exclusive slots, students
book them. CPE 334 project, team EN-036 "Y Que Fue". Contracts and requirements live in [`docs/`](docs/).

## Prerequisites

- Node 20 or newer (tested with 20 and 24); at least 20.12, as in `engines` of `package.json`. npm 10 or newer.
- PostgreSQL 16 or newer (tested with 16 and 18), running locally.

## Setup

**1. Database role and databases (once).** Create a PostgreSQL role `slotbook` that owns `slotbook` and
`slotbook_test`, with a local password you choose (replace `<local-password>` below). Use the **same value** in
`DATABASE_URL` and `DATABASE_URL_TEST` of your `.env` (step 2), in place of `change-me`. Create them as the PostgreSQL
superuser; `psql` asks for that user's password. Use `psql -U postgres -h localhost …` with the EDB installer
(Windows/macOS), `sudo -u postgres psql …` on Linux, and `psql -d postgres …` as your own user with
Homebrew/Postgres.app. In Git Bash, if the password prompt does not appear, prefix the command with
`PGPASSWORD=<postgres password>` or use `winpty psql …`:

```bash
psql -U postgres -h localhost -c "CREATE ROLE slotbook LOGIN CREATEDB PASSWORD '<local-password>';" -c "CREATE DATABASE slotbook OWNER slotbook;" -c "CREATE DATABASE slotbook_test OWNER slotbook;"
```

If you use another role or password, put it in `DATABASE_URL` and `DATABASE_URL_TEST` of your `.env`. The test
database name must end in `_test` (the test setup refuses anything else).

**2. Install, migrate, seed, test, run** (from the repository root):

```bash
cp .env.example .env               # first: install:all needs it; then replace every change-me (see the comments in the file)
npm run install:all                # root + server + client, then generates the Prisma client in server/
npx playwright install chromium    # browser for npm run test:e2e, once per machine (Linux: add --with-deps)
npm run db:migrate                 # applies server/prisma/migrations to DATABASE_URL
npm run db:seed                    # synthetic data; safe to run again (idempotent)
npm test                           # server then client tests (uses slotbook_test only)
npm run dev                        # API on http://localhost:3000, app on http://localhost:5173
```

`.env` is git-ignored; only `.env.example` (placeholders) is committed. With `NODE_ENV=production` the seed
writes nothing unless `SEED_DEMO_DATA=true` and `SEED_PASSWORD` are set. Cloud deployment:
[`docs/labs/lab-05/deployment.md`](docs/labs/lab-05/deployment.md).

**npm 12 or newer** blocks dependency install scripts that are not listed in `allowScripts` and prints
`npm warn install-scripts … had install scripts blocked` for `prisma`, `@prisma/client`, `@prisma/engines`,
`bcrypt` and `esbuild`; the install still exits 0. The project works without those scripts: `install:all` runs
`npm run db:generate` itself (Prisma client in `server/node_modules/.prisma`), Prisma downloads its engines on
first use, and bcrypt and esbuild use their prebuilt binaries. To run the scripts anyway, use
`npm install-scripts approve <package>` in `server/` or `client/`. With npm 10 or 11 there is no warning.

## Seeded accounts

All accounts use the password you set in `SEED_PASSWORD` in your `.env`.

| Role | E-mail | Name |
| :--- | :--- | :--- |
| Staff | `staff.anan@slotbook.test` | Anan Wong |
| Staff | `staff.mali@slotbook.test` | Mali Srisuk |
| Customer | `cust.ploy@slotbook.test` | Ploy Chai |
| Customer | `cust.ken@slotbook.test` | Ken Tan |
| Customer | `cust.nina@slotbook.test` | Nina Park (no bookings) |
| Customer (inactive) | `cust.old@slotbook.test` | Old Account (cannot log in) |

The seed also creates 4 services (one inactive), slots at fixed times from 2 days ago to 7 days ahead
(Asia/Bangkok) and bookings in every status. Dates are relative to the day you seed: on a later day, run
`npm run db:reset` for a clean data set instead of seeding on top of the old one.

## Tests

```bash
npm test                    # server (Vitest + Supertest, resets and seeds slotbook_test) then client (Vitest + jsdom)
npm run test:e2e            # Playwright; starts the API on the test database and the app itself
```

Ports 3000 and 5173 must be free before `npm run test:e2e` (stop `npm run dev` first). The suite includes
`e2e/demo-evidence.spec.ts` (`SHOT-01`), so **every `npm run test:e2e` rewrites the committed demo screenshots** in
`artifacts/sprint-1/screenshots/` (see its `INDEX.md`). Their dates and references change from run to run:
commit them only when you mean to replace the evidence, otherwise restore them with
`git checkout -- artifacts/sprint-1/screenshots`.

## Known limitations

- `npm audit` (2026-11-10) reports advisories that `npm audit fix` cannot fix without breaking upgrades
  (`npm audit fix --force`), so they are not applied in Sprint 1:
  - `vitest` and `tinypool` (**critical**) and `@vitest/mocker` (moderate), in `server/` and `client/`, fixed in
    vitest 5. They are development-only test tools and are not shipped with the app.
  - `zod` (**high**, `server/`, fixed in zod 4): memory exhaustion when validating oversized constrained
    collections. The app's schemas validate no array, set, record or map, and request bodies are limited to 100 kB.
  - `react-router-dom` / `react-router` (moderate, `client/`, fixed in 7).
  - The root package has none. Upgrading `zod` and `react-router-dom` to the next major version is an open
    decision for the team.

## Other commands

| Command | Purpose |
| :--- | :--- |
| `npm run db:generate` | Regenerate the Prisma client in `server/` (after a change to `schema.prisma`) |
| `npm run build` | Compile the server (`server/dist`) and build the client (`client/dist`) |
| `npm run db:migrate:dev` | Create a new migration from `server/prisma/schema.prisma` (development) |
| `npm run db:reset` | Drop, re-migrate and re-seed the development database |
| `npm run demo:readback -- <reference>` | Print one booking joined with its slot, service, staff and customer, straight from PostgreSQL (`DATABASE_URL`) |
