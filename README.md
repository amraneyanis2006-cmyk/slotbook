# SlotBook

Appointment booking for a university Student Service Center: staff publish exclusive slots, students
book them. CPE 334 project, team EN-036 "Y Que Fue". Contracts and requirements live in [`docs/`](docs/).

## Prerequisites

- Node.js 20.12 or newer (npm 10+)
- PostgreSQL 16 running locally

## Setup

```bash
createdb slotbook
createdb slotbook_test
cp .env.example .env        # then edit DATABASE_URL / DATABASE_URL_TEST for your local PostgreSQL user
npm run install:all         # root + server + client (also generates the Prisma client)
npm run db:migrate          # applies server/prisma/migrations
npm run db:seed             # synthetic data; safe to run again (idempotent)
npm run dev                 # API on http://localhost:3000, app on http://localhost:5173
```

`.env` is git-ignored; only `.env.example` (synthetic values) is committed. The seed refuses to run when
`NODE_ENV=production`.

## Seeded accounts

All accounts use the password set in `SEED_PASSWORD` in your `.env` (the example value is
`slotbook-dev-password`, a synthetic local password).

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

Ports 3000 and 5173 must be free before `npm run test:e2e`. The suite includes `e2e/demo-evidence.spec.ts`
(`SHOT-01`), which rewrites the demo screenshots in `artifacts/sprint-1/screenshots/` (see its `INDEX.md`).

## Other commands

| Command | Purpose |
| :--- | :--- |
| `npm run build` | Compile the server (`server/dist`) and build the client (`client/dist`) |
| `npm run db:migrate:dev` | Create a new migration from `server/prisma/schema.prisma` (development) |
| `npm run db:reset` | Drop, re-migrate and re-seed the development database |
| `npm run demo:readback -- <reference>` | Print one booking joined with its slot, service, staff and customer, straight from PostgreSQL (`DATABASE_URL`) |
