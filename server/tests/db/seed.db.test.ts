import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
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

    const statuses = (await prisma.booking.findMany({ select: { status: true } })).map((b) => b.status);
    expect(statuses).toEqual(expect.arrayContaining(['BOOKED', 'BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']));
  });
});
