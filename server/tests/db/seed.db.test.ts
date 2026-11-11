import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { seed } from '../../prisma/seed.js';

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

  it('DB-03: with NODE_ENV=production the seed writes nothing unless SEED_DEMO_DATA=true and SEED_PASSWORD is set', async () => {
    const password = process.env.SEED_PASSWORD!;
    vi.stubEnv('NODE_ENV', 'production');
    const log = vi.spyOn(console, 'log');

    for (const flag of [undefined, '', 'false', '1']) {
      vi.stubEnv('SEED_DEMO_DATA', flag);
      await expect(seed(untouchable), String(flag)).resolves.toBe('skipped');
    }
    vi.stubEnv('SEED_DEMO_DATA', 'true');
    vi.stubEnv('SEED_PASSWORD', '');
    await expect(seed(untouchable)).rejects.toThrow('SEED_PASSWORD is not set');

    vi.stubEnv('SEED_PASSWORD', password);
    await expect(seed(prisma)).resolves.toBe('seeded');
    expect(JSON.stringify(log.mock.calls)).not.toContain(password);
  }, 30_000);
});
