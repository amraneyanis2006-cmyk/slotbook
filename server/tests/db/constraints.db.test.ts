import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { bkk, makeBooking, makeSlot, removeSlotsBetween } from '../helpers.js';

// This file owns the slots of May 2030.
const prisma = new PrismaClient();
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2030-05-01', '00:00'), bkk('2030-06-01', '00:00'));
  await prisma.$disconnect();
});

describe('database constraints (F-00, BR-01)', () => {
  it('DB-01: a second BOOKED booking for one slot fails with P2002 on booking_one_active_per_slot; a second CANCELLED one is allowed', async () => {
    const staffId = (await prisma.user.findUniqueOrThrow({ where: { email: 'staff.anan@slotbook.test' } })).id;
    const serviceId = (await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } })).id;
    const [ploy, ken, nina] = await Promise.all(['cust.ploy', 'cust.ken', 'cust.nina']
      .map((name) => prisma.user.findUniqueOrThrow({ where: { email: `${name}@slotbook.test` } }).then((u) => u.id)));
    const slot = await makeSlot(prisma, { staffId, serviceId, date: '2030-05-06', time: '10:00' });

    await makeBooking(prisma, { slotId: slot.id, customerId: ploy });
    const second = await makeBooking(prisma, { slotId: slot.id, customerId: ken }).catch((err: unknown) => err);

    expect(second).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((second as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
    expect(String((second as Prisma.PrismaClientKnownRequestError).meta?.target)).toMatch(/booking_one_active_per_slot|slotId/);
    // The index named in the contract is the one that exists, and it is partial on status = 'BOOKED'.
    const [index] = await prisma.$queryRaw<{ indexdef: string }[]>`SELECT indexdef FROM pg_indexes WHERE indexname = 'booking_one_active_per_slot'`;
    expect(index.indexdef).toMatch(/UNIQUE INDEX booking_one_active_per_slot .*\("slotId"\) WHERE \(status = 'BOOKED'/);

    await expect(makeBooking(prisma, { slotId: slot.id, customerId: nina, status: 'CANCELLED' })).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(await prisma.booking.count({ where: { slotId: slot.id, status: 'BOOKED' } })).toBe(1);
  });
});
