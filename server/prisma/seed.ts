// Idempotent synthetic seed (F-00 §2): two runs in a row give the same counts.
import bcrypt from 'bcrypt';
import { PrismaClient, type BookingStatus, type Role, type SlotStatus } from '@prisma/client';
import { formatReference } from '../src/rules/bookingRules.js';
import { addDays, bangkokDate, bangkokToUtc } from '../src/utils/time.js';

const SERVICES = [
  { name: 'Academic advising', durationMin: 30, isActive: true },
  { name: 'Document request', durationMin: 15, isActive: true },
  { name: 'Career counselling', durationMin: 45, isActive: true },
  { name: 'Thesis consultation', durationMin: 60, isActive: false },
];

const USERS: { email: string; name: string; role: Role; isActive: boolean }[] = [
  { email: 'staff.anan@slotbook.test', name: 'Anan Wong', role: 'STAFF', isActive: true },
  { email: 'staff.mali@slotbook.test', name: 'Mali Srisuk', role: 'STAFF', isActive: true },
  { email: 'cust.ploy@slotbook.test', name: 'Ploy Chai', role: 'CUSTOMER', isActive: true },
  { email: 'cust.ken@slotbook.test', name: 'Ken Tan', role: 'CUSTOMER', isActive: true },
  { email: 'cust.nina@slotbook.test', name: 'Nina Park', role: 'CUSTOMER', isActive: true },
  { email: 'cust.old@slotbook.test', name: 'Old Account', role: 'CUSTOMER', isActive: false },
];

// Fixed local times per staff member, repeated on every day today−2 .. today+7.
const DAY_PATTERN = [
  { staff: 'staff.anan@slotbook.test', time: '09:00', service: 'Academic advising' },
  { staff: 'staff.anan@slotbook.test', time: '10:00', service: 'Document request' },
  { staff: 'staff.anan@slotbook.test', time: '13:00', service: 'Career counselling' },
  { staff: 'staff.mali@slotbook.test', time: '09:30', service: 'Academic advising' },
  { staff: 'staff.mali@slotbook.test', time: '14:00', service: 'Academic advising' },
];
const FIRST_DAY = -2;
const LAST_DAY = 7;

// Special slots and bookings, addressed by (day offset, staff, time).
const CLOSED_SLOT = { day: 2, staff: 'staff.anan@slotbook.test', time: '13:00' };
const BOOKINGS: { day: number; staff: string; time: string; customer: string; status: BookingStatus; note?: string }[] = [
  { day: 1, staff: 'staff.anan@slotbook.test', time: '09:00', customer: 'cust.ploy@slotbook.test', status: 'BOOKED', note: 'Question about credit transfer' },
  { day: 1, staff: 'staff.mali@slotbook.test', time: '09:30', customer: 'cust.ploy@slotbook.test', status: 'CANCELLED' },
  { day: 3, staff: 'staff.anan@slotbook.test', time: '10:00', customer: 'cust.ken@slotbook.test', status: 'BOOKED' },
  { day: -1, staff: 'staff.anan@slotbook.test', time: '09:00', customer: 'cust.ken@slotbook.test', status: 'COMPLETED' },
  { day: -2, staff: 'staff.mali@slotbook.test', time: '09:30', customer: 'cust.ken@slotbook.test', status: 'NO_SHOW' },
];

export async function seed(prisma: PrismaClient, today = bangkokDate(new Date())): Promise<'seeded' | 'skipped'> {
  // Production seeds the demo accounts (Lab 6 UAT) only on explicit request (F-00 §2).
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_DATA !== 'true') return 'skipped';
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error('SEED_PASSWORD is not set (see .env.example).');
  // Production reruns on every release: create what is missing, never change a row users may have changed.
  const insertOnly = process.env.NODE_ENV === 'production';

  const services = new Map<string, { id: number; durationMin: number }>();
  for (const s of SERVICES) {
    services.set(s.name, await prisma.service.upsert({ where: { name: s.name }, update: insertOnly ? {} : s, create: s }));
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const users = new Map<string, number>();
  for (const u of USERS) {
    const row = await prisma.user.upsert({ where: { email: u.email }, update: insertOnly ? {} : { ...u, passwordHash }, create: { ...u, passwordHash } });
    users.set(u.email, row.id);
  }

  // Demo slots and bookings are relative to the seed day: in production only on an empty database (first run).
  if (insertOnly && await prisma.slot.count() > 0) return 'seeded';

  const slotAt = async (day: number, staff: string, time: string, service: string, status: SlotStatus) => {
    const staffId = users.get(staff)!;
    const { id: serviceId, durationMin } = services.get(service)!;
    const startAt = bangkokToUtc(addDays(today, day), time);
    const data = { staffId, serviceId, startAt, endAt: new Date(startAt.getTime() + durationMin * 60_000), status };
    const existing = await prisma.slot.findFirst({ where: { staffId, startAt } });
    return existing
      ? prisma.slot.update({ where: { id: existing.id }, data })
      : prisma.slot.create({ data });
  };

  const slotIds = new Map<string, number>();
  for (let day = FIRST_DAY; day <= LAST_DAY; day++) {
    for (const p of DAY_PATTERN) {
      const closed = day === CLOSED_SLOT.day && p.staff === CLOSED_SLOT.staff && p.time === CLOSED_SLOT.time;
      const slot = await slotAt(day, p.staff, p.time, p.service, closed ? 'CLOSED' : 'OPEN');
      slotIds.set(`${day}|${p.staff}|${p.time}`, slot.id);
    }
  }

  for (const b of BOOKINGS) {
    const slotId = slotIds.get(`${b.day}|${b.staff}|${b.time}`)!;
    const customerId = users.get(b.customer)!;
    const data = {
      status: b.status,
      note: b.note ?? null,
      cancelledAt: b.status === 'CANCELLED' ? new Date() : null,
      cancelledById: b.status === 'CANCELLED' ? customerId : null,
    };
    const existing = await prisma.booking.findFirst({ where: { slotId, customerId } });
    if (existing) {
      await prisma.booking.update({ where: { id: existing.id }, data: { ...data, cancelledAt: existing.cancelledAt ?? data.cancelledAt } });
    } else {
      const [{ seq }] = await prisma.$queryRaw<{ seq: bigint }[]>`SELECT nextval('booking_ref_seq') AS seq`;
      const reference = formatReference(Number(today.slice(0, 4)), Number(seq));
      await prisma.booking.create({ data: { ...data, slotId, customerId, reference } });
    }
  }
  return 'seeded';
}

const countRows = async (prisma: PrismaClient) => ({
  services: await prisma.service.count(), users: await prisma.user.count(),
  slots: await prisma.slot.count(), bookings: await prisma.booking.count(),
});
const PLANNED = {
  services: SERVICES.length, users: USERS.length,
  slots: (LAST_DAY - FIRST_DAY + 1) * DAY_PATTERN.length, bookings: BOOKINGS.length,
};

if (process.argv[1]?.endsWith('seed.ts')) {
  const prisma = new PrismaClient();
  countRows(prisma)
    .then(async (before) => {
      if (await seed(prisma) === 'skipped') {
        console.log('Seed skipped: NODE_ENV=production and SEED_DEMO_DATA is not "true". Nothing was written.');
        return;
      }
      const after = await countRows(prisma);
      const keys = Object.keys(PLANNED) as (keyof typeof PLANNED)[];
      const created = keys.map((k) => `${after[k] - before[k]} ${k}`).join(', ');
      const skipped = keys.map((k) => `${Math.max(PLANNED[k] - (after[k] - before[k]), 0)} ${k}`).join(', ');
      console.log(`Seed complete. Created: ${created}. Already present (${process.env.NODE_ENV === 'production' ? 'left unchanged' : 'updated'}): ${skipped}.`);
    })
    .catch((err) => { console.error(err.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
