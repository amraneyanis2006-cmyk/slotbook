// npm run demo:readback -- <reference>
// Prints one booking joined with its slot, service, staff and customer, read straight from PostgreSQL
// (DATABASE_URL; no password or hash column is selected). Demo evidence for Part F of the Deliverable 1 report.
import { createRequire } from 'node:module';

type Client = { $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>; $disconnect(): Promise<void> };
const { PrismaClient } = createRequire(new URL('../server/package.json', import.meta.url))('@prisma/client') as { PrismaClient: new () => Client };

const reference = process.argv[2]?.toUpperCase();
if (!reference) {
  console.error('Usage: npm run demo:readback -- <reference>');
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRaw`
    SELECT b.id, b.reference, b.status, b.note, b."createdAt", b."cancelledAt",
           s.id AS "slotId", s."startAt", s."endAt", s.status AS "slotStatus",
           sv.name AS service, sv."durationMin",
           st.id AS "staffId", st.name AS staff, st.email AS "staffEmail",
           c.id AS "customerId", c.name AS customer, c.email AS "customerEmail"
    FROM "Booking" b
    JOIN "Slot" s ON s.id = b."slotId"
    JOIN "Service" sv ON sv.id = s."serviceId"
    JOIN "User" st ON st.id = s."staffId"
    JOIN "User" c ON c.id = b."customerId"
    WHERE b.reference = ${reference}`;
  console.log(`Database: ${new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)}`);
  console.log(rows.length ? JSON.stringify(rows[0], null, 2) : `No booking with reference ${reference}.`);
  if (!rows.length) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
