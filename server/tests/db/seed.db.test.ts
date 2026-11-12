import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { seed } from '../../prisma/seed.js';
import { addDays, bangkokDate, bangkokToUtc } from '../../src/utils/time.js';
import { makeBooking } from '../helpers.js';

const prisma = new PrismaClient();
afterAll(() => prisma.$disconnect());

const counts = async () => ({
  users: await prisma.user.count(),
  services: await prisma.service.count(),
  slots: await prisma.slot.count(),
  bookings: await prisma.booking.count(),
});

describe('seed (F-00)', () => {
  it('DB-02: running the seed twice gives the same counts, the seeded accounts with roles and no plaintext password', async () => {
    await seed(prisma);
    const first = await counts();
    await seed(prisma);

    expect(await counts()).toEqual(first);
    // Other test files add their own slots/bookings to the shared test DB, so totals are lower bounds.
    expect(first).toMatchObject({ users: 6, services: 4 });
    expect(first.slots).toBeGreaterThanOrEqual(50); // 10 days × 5 fixed times

    const users = await prisma.user.findMany();
    expect(Object.fromEntries(users.map((u) => [u.email, [u.role, u.isActive]]))).toEqual({
      'staff.anan@slotbook.test': ['STAFF', true],
      'staff.mali@slotbook.test': ['STAFF', true],
      'cust.ploy@slotbook.test': ['CUSTOMER', true],
      'cust.ken@slotbook.test': ['CUSTOMER', true],
      'cust.nina@slotbook.test': ['CUSTOMER', true],
      'cust.old@slotbook.test': ['CUSTOMER', false],
    });
    for (const user of users) {
      expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
      expect(Object.values(user)).not.toContain(process.env.SEED_PASSWORD);
    }

    const bookings = await prisma.booking.findMany({ select: { reference: true, status: true, customer: { select: { email: true } } } });
    expect(bookings.map((b) => `${b.customer.email} ${b.status}`)).toEqual(expect.arrayContaining([
      'cust.ploy@slotbook.test BOOKED',
      'cust.ploy@slotbook.test CANCELLED',
      'cust.ken@slotbook.test BOOKED',
      'cust.ken@slotbook.test COMPLETED',
      'cust.ken@slotbook.test NO_SHOW',
    ]));
    for (const b of bookings) expect(b.reference).toMatch(/^BK-\d{4}-\d{6}$/);
  }, 30_000); // two full seeds incl. bcrypt cost 12 take ~4-5 s, above Vitest's 5 s default
});

describe('seed in production (F-00, NFR-12)', () => {
  afterEach(() => vi.unstubAllEnvs());
  // Any use of this client means the seed tried to touch the database.
  const untouchable = new Proxy({}, { get: (_t, key) => { throw new Error(`seed touched prisma.${String(key)}`); } }) as PrismaClient;
  // The real command line (npm run db:seed), on the test database, so its output is what gets checked.
  const cli = (flag: string) => spawnSync(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'production', SEED_DEMO_DATA: flag },
    encoding: 'utf8',
    timeout: 30_000,
  });

  it('DB-03: with NODE_ENV=production the seed writes nothing unless SEED_DEMO_DATA=true and SEED_PASSWORD is set', async () => {
    const password = process.env.SEED_PASSWORD!;
    vi.stubEnv('NODE_ENV', 'production');
    for (const flag of [undefined, '', 'false', '1']) {
      vi.stubEnv('SEED_DEMO_DATA', flag);
      await expect(seed(untouchable), String(flag)).resolves.toBe('skipped');
    }
    vi.stubEnv('SEED_DEMO_DATA', 'true');
    vi.stubEnv('SEED_PASSWORD', '');
    await expect(seed(untouchable)).rejects.toThrow('SEED_PASSWORD is not set');

    vi.unstubAllEnvs(); // the child gets the real SEED_PASSWORD and the test DATABASE_URL
    const skipped = cli('false');
    expect(skipped.status).toBe(0);
    expect(skipped.stdout).toMatch(/Seed skipped/);
    const seeded = cli('true');
    expect(seeded.status).toBe(0);
    // Insert-only on the already seeded test DB: counts only, nothing created.
    expect(seeded.stdout).toMatch(/Seed complete\. Created: 0 services, 0 users, 0 slots, 0 bookings\. Already present \(left unchanged\): 4 services, 6 users, 50 slots, 5 bookings\./);
    expect(seeded.stdout + seeded.stderr).not.toContain(password);
  }, 60_000);
});

describe('seed rerun in production (F-00, NFR-12)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('DB-04: with NODE_ENV=production and SEED_DEMO_DATA=true a later rerun is insert-only: a changed password hash, a closed seeded slot and a UAT booking stay as they are, and no booking is created', async () => {
    const today = bangkokDate(new Date());
    const nina = await prisma.user.findUniqueOrThrow({ where: { email: 'cust.nina@slotbook.test' } });
    const anan = await prisma.user.findUniqueOrThrow({ where: { email: 'staff.anan@slotbook.test' } });
    // Seeded OPEN slots that a next-day seed would reopen (today+3 09:00) and book for Ploy (today+2 09:00).
    const toClose = await prisma.slot.findFirstOrThrow({ where: { staffId: anan.id, startAt: bangkokToUtc(addDays(today, 3), '09:00') } });
    const toBook = await prisma.slot.findFirstOrThrow({ where: { staffId: anan.id, startAt: bangkokToUtc(addDays(today, 2), '09:00'), bookings: { none: {} } } });

    await prisma.user.update({ where: { id: nina.id }, data: { passwordHash: 'changed-by-uat' } });
    await prisma.slot.update({ where: { id: toClose.id }, data: { status: 'CLOSED' } });
    const uatBooking = await makeBooking(prisma, { slotId: toBook.id, customerId: nina.id });
    try {
      const before = await counts();
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('SEED_DEMO_DATA', 'true');
      await seed(prisma, addDays(today, 1)); // the next release, one day later

      expect(await counts()).toEqual(before);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: nina.id } })).passwordHash).toBe('changed-by-uat');
      expect((await prisma.slot.findUniqueOrThrow({ where: { id: toClose.id } })).status).toBe('CLOSED');
      expect(await prisma.booking.findMany({ where: { slotId: toBook.id }, select: { id: true, customerId: true, status: true } }))
        .toEqual([{ id: uatBooking.id, customerId: nina.id, status: 'BOOKED' }]);
    } finally {
      await prisma.booking.delete({ where: { id: uatBooking.id } });
      await prisma.slot.update({ where: { id: toClose.id }, data: { status: 'OPEN' } });
      await prisma.user.update({ where: { id: nina.id }, data: { passwordHash: nina.passwordHash } });
    }
  }, 30_000);
});
