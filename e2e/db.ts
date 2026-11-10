import { createRequire } from 'node:module';
import { formatReference } from '../server/src/rules/bookingRules';

// Direct access to the E2E (test) database for the one demo situation the API cannot create at any time of day:
// a booking that starts in less than 2 hours (BR-02 needs ≥ 60 min, BR-06 opening hours). Rules are bypassed on
// purpose; INDEX.md says so. @prisma/client lives in server/node_modules, so it is resolved from there.
type Row = { id: number; reference: string };
type Client = {
  user: { findUniqueOrThrow(args: object): Promise<Row> };
  service: { findUniqueOrThrow(args: object): Promise<Row> };
  slot: { create(args: object): Promise<Row>; delete(args: object): Promise<Row> };
  booking: { create(args: object): Promise<Row>; delete(args: object): Promise<Row & { slotId: number }> };
  $queryRaw(query: TemplateStringsArray): Promise<{ seq: bigint }[]>;
  $disconnect(): Promise<void>;
};
const { PrismaClient } = createRequire(new URL('../server/package.json', import.meta.url))('@prisma/client') as {
  PrismaClient: new (options: { datasourceUrl?: string }) => Client;
};

async function withDb<T>(work: (prisma: Client) => Promise<T>): Promise<T> {
  const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
  try {
    return await work(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

/** Inserts a 30-min Academic advising slot of `staffEmail` at `startAt` and a BOOKED booking of `customerEmail` on it. */
export const insertBooking = (staffEmail: string, customerEmail: string, startAt: Date) => withDb(async (prisma) => {
  const staffId = (await prisma.user.findUniqueOrThrow({ where: { email: staffEmail } })).id;
  const customerId = (await prisma.user.findUniqueOrThrow({ where: { email: customerEmail } })).id;
  const serviceId = (await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } })).id;
  const slot = await prisma.slot.create({ data: { staffId, serviceId, startAt, endAt: new Date(startAt.getTime() + 30 * 60_000) } });
  const [{ seq }] = await prisma.$queryRaw`SELECT nextval('booking_ref_seq') AS seq`;
  const year = new Date(Date.now() + 7 * 3_600_000).getUTCFullYear(); // Asia/Bangkok year (BR-10)
  return (await prisma.booking.create({ data: { slotId: slot.id, customerId, reference: formatReference(year, Number(seq)) } })).reference;
});

/** Removes a booking made by insertBooking and its slot, so later specs see the customer's usual bookings. */
export const deleteBooking = (reference: string) => withDb(async (prisma) => {
  const booking = await prisma.booking.delete({ where: { reference } });
  await prisma.slot.delete({ where: { id: booking.slotId } });
});
