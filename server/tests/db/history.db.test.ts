import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed } from '../../prisma/seed.js';
import { bkk, makeBooking, makeSlot, removeSlotsBetween } from '../helpers.js';

// This file owns the slots of July 2030.
const prisma = new PrismaClient();
const prismaDir = fileURLToPath(new URL('../../prisma/', import.meta.url));
const ids = { anan: 0, ploy: 0, advising: 0 };

beforeAll(async () => {
  ids.anan = (await prisma.user.findUniqueOrThrow({ where: { email: 'staff.anan@slotbook.test' } })).id;
  ids.ploy = (await prisma.user.findUniqueOrThrow({ where: { email: 'cust.ploy@slotbook.test' } })).id;
  ids.advising = (await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } })).id;
});
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2030-07-01', '00:00'), bkk('2030-08-01', '00:00'));
  await prisma.$disconnect();
});

describe('BookingStatusChange is append-only (F-10 §1 step 4, BR-17)', () => {
  it('DB-05: Prisma update/delete and raw UPDATE are refused by the trigger; deleting the booking itself cascades', async () => {
    const slot = await makeSlot(prisma, { staffId: ids.anan, serviceId: ids.advising, date: '2030-07-02', time: '09:00' });
    const booking = await makeBooking(prisma, { slotId: slot.id, customerId: ids.ploy });
    const row = await prisma.bookingStatusChange.create({
      data: { bookingId: booking.id, fromStatus: null, toStatus: 'BOOKED', actorId: ids.ploy, createdAt: new Date() },
    });
    await expect(prisma.bookingStatusChange.update({ where: { id: row.id }, data: { reason: 'edited' } })).rejects.toThrow(/append-only/);
    await expect(prisma.bookingStatusChange.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRaw`UPDATE "BookingStatusChange" SET "toStatus" = 'CANCELLED' WHERE id = ${row.id}`).rejects.toThrow(/append-only/);
    expect(await prisma.bookingStatusChange.findUniqueOrThrow({ where: { id: row.id } })).toEqual(row);

    await prisma.booking.delete({ where: { id: booking.id } });
    expect(await prisma.bookingStatusChange.count({ where: { id: row.id } })).toBe(0);
  });
});

describe('history backfill (F-10 §1 step 5)', () => {
  it('DB-06: the migration backfill gives every booking a history ending in its status, with the marker reason on second rows; the seed uses the same SQL and keeps the counts', async () => {
    const migration = readdirSync(`${prismaDir}migrations`).find((d) => d.endsWith('_booking_history'));
    expect(migration).toBeDefined();
    const sql = readFileSync(`${prismaDir}migrations/${migration}/migration.sql`, 'utf8');
    const block = /-- backfill:start\n([\s\S]*?)-- backfill:end/.exec(sql)?.[1];
    expect(block?.trim()).toBe(readFileSync(`${prismaDir}sql/backfill-history.sql`, 'utf8').trim());

    await prisma.$executeRawUnsafe('TRUNCATE "BookingStatusChange"');
    await prisma.$executeRawUnsafe(block!);
    const bookings = await prisma.booking.findMany({
      include: { history: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }, slot: true },
    });
    expect(bookings.length).toBeGreaterThan(0);
    for (const b of bookings) {
      expect(b.history[0]).toMatchObject({ fromStatus: null, toStatus: 'BOOKED', actorId: b.customerId, reason: null });
      expect(b.history.at(-1)!.toStatus).toBe(b.status);
      if (b.status === 'BOOKED') expect(b.history).toHaveLength(1);
      else {
        expect(b.history).toHaveLength(2);
        expect(b.history[1]).toMatchObject({ fromStatus: 'BOOKED', reason: 'Recorded before history (Sprint 1)' });
        expect(b.history[1].actorId).toBe(b.status === 'CANCELLED' ? (b.cancelledById ?? b.customerId) : b.slot.staffId);
        expect(b.history[1].createdAt.getTime()).toBeGreaterThanOrEqual(b.history[0].createdAt.getTime());
      }
    }

    const count = await prisma.bookingStatusChange.count();
    await prisma.$executeRawUnsafe(block!); // only bookings without history are filled
    await seed(prisma);
    expect(await prisma.bookingStatusChange.count()).toBe(count);
  });
});
