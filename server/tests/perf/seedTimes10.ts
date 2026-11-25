// NFR-11 test data (F-12 §5): 9 more copies of the seed's slots and bookings, with their own staff and customer
// accounts, so the _test database holds the seed data ×10. Only ever run against the reset _test database.
import type { PrismaClient } from '@prisma/client';
import { formatReference } from '../../src/rules/bookingRules.js';
import { addDays, bangkokDate, bangkokToUtc } from '../../src/utils/time.js';

const TIMES = ['09:00', '10:00', '13:00', '09:30', '14:00'];
const SERVICES = ['Academic advising', 'Document request', 'Career counselling', 'Academic advising', 'Academic advising'];

export async function seedTimes10(prisma: PrismaClient, copies = 9) {
  const today = bangkokDate(new Date());
  const services = new Map((await prisma.service.findMany()).map((s) => [s.name, s]));
  const passwordHash = (await prisma.user.findFirstOrThrow({ where: { role: 'STAFF' } })).passwordHash;
  for (let copy = 1; copy <= copies; copy++) {
    const staff = await Promise.all([1, 2].map((n) => prisma.user.create({
      data: { email: `staff.perf${copy}-${n}@slotbook.test`, name: `Perf Staff ${copy}-${n}`, role: 'STAFF', passwordHash },
    })));
    const customers = await Promise.all([1, 2, 3].map((n) => prisma.user.create({
      data: { email: `cust.perf${copy}-${n}@slotbook.test`, name: `Perf Customer ${copy}-${n}`, role: 'CUSTOMER', passwordHash },
    })));
    for (let day = -2; day <= 7; day++) {
      for (let i = 0; i < TIMES.length; i++) {
        const service = services.get(SERVICES[i])!;
        const startAt = bangkokToUtc(addDays(today, day), TIMES[i]);
        const slot = await prisma.slot.create({
          data: { staffId: staff[i < 3 ? 0 : 1].id, serviceId: service.id, startAt, endAt: new Date(startAt.getTime() + service.durationMin * 60_000) },
        });
        // Same booking pattern as the seed: 5 bookings per copy (2 future BOOKED, 1 CANCELLED, 1 COMPLETED, 1 NO_SHOW).
        const pattern = [[1, 0, 'BOOKED'], [1, 3, 'CANCELLED'], [3, 1, 'BOOKED'], [-1, 0, 'COMPLETED'], [-2, 3, 'NO_SHOW']] as const;
        const match = pattern.find(([d, t]) => d === day && t === i);
        if (match) {
          const [{ seq }] = await prisma.$queryRaw<{ seq: bigint }[]>`SELECT nextval('booking_ref_seq') AS seq`;
          await prisma.booking.create({
            data: {
              slotId: slot.id, customerId: customers[copy % 3].id, status: match[2], reference: formatReference(Number(today.slice(0, 4)), Number(seq)),
              ...(match[2] === 'CANCELLED' && { cancelledAt: new Date(), cancelledById: customers[copy % 3].id }),
            },
          });
        }
      }
    }
  }
  return { slots: await prisma.slot.count(), bookings: await prisma.booking.count() };
}
