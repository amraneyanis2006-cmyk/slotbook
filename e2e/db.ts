import { createRequire } from 'node:module';
import { formatReference } from '../server/src/rules/bookingRules';

// Direct access to the E2E (test) database for set-up the API cannot express: a slot that starts in less than
// 2 hours already booked. @prisma/client lives in server/node_modules, so it is resolved from there.
type Row = { id: number; reference?: string };
type Client = {
  user: { findUniqueOrThrow(args: object): Promise<Row> };
  service: { findUniqueOrThrow(args: object): Promise<Row> };
  slot: { create(args: object): Promise<Row> };
  booking: { create(args: object): Promise<Row & { reference: string }> };
  $queryRaw(query: TemplateStringsArray): Promise<{ seq: bigint }[]>;
  $disconnect(): Promise<void>;
};
const { PrismaClient } = createRequire(new URL('../server/package.json', import.meta.url))('@prisma/client') as {
  PrismaClient: new (options: { datasourceUrl?: string }) => Client;
};

const MINUTE = 60_000;
const idOf = (row: Row) => row.id;

/** Inserts an Academic advising slot for `staffEmail` starting at `startAt` (no rule check). */
export async function insertSlot(staffEmail: string, startAt: Date) {
  const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
  try {
    const staffId = idOf(await prisma.user.findUniqueOrThrow({ where: { email: staffEmail } }));
    const serviceId = idOf(await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } }));
    return idOf(await prisma.slot.create({ data: { staffId, serviceId, startAt, endAt: new Date(startAt.getTime() + 30 * MINUTE) } }));
  } finally {
    await prisma.$disconnect();
  }
}

/** Inserts a BOOKED booking of `customerEmail` on a new slot of `staffEmail` starting at `startAt`; returns its reference. */
export async function insertBooking(staffEmail: string, customerEmail: string, startAt: Date) {
  const slotId = await insertSlot(staffEmail, startAt);
  const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
  try {
    const customerId = idOf(await prisma.user.findUniqueOrThrow({ where: { email: customerEmail } }));
    const [{ seq }] = await prisma.$queryRaw`SELECT nextval('booking_ref_seq') AS seq`;
    const year = new Date(Date.now() + 7 * 60 * MINUTE).getUTCFullYear(); // Asia/Bangkok year (BR-10)
    return (await prisma.booking.create({ data: { slotId, customerId, reference: formatReference(year, Number(seq)) } })).reference;
  } finally {
    await prisma.$disconnect();
  }
}
