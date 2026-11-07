// Vitest globalSetup (once per run) and E2E global setup: reset + seed the TEST database only.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { seed } from '../prisma/seed.js';
import { addDays, bangkokDate, bangkokToUtc } from '../src/utils/time.js';

const serverDir = fileURLToPath(new URL('..', import.meta.url));

export async function resetTestDb({ e2eSlot = false } = {}): Promise<void> {
  const url = process.env.DATABASE_URL_TEST;
  // Safety: never reset anything but a database whose name ends in _test and differs from DATABASE_URL.
  if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_TEST must name a separate *_test database.');
  }
  execSync('npx prisma migrate reset --force --skip-generate --skip-seed', {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await seed(prisma);
    if (e2eSlot) {
      // E2E-04/05/06 slot: Mali, today+10 at 15:00, outside the seed range (today−2..today+7).
      const mali = await prisma.user.findUniqueOrThrow({ where: { email: 'staff.mali@slotbook.test' } });
      const service = await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } });
      const startAt = bangkokToUtc(addDays(bangkokDate(new Date()), 10), '15:00');
      await prisma.slot.create({
        data: { staffId: mali.id, serviceId: service.id, startAt, endAt: new Date(startAt.getTime() + service.durationMin * 60_000) },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

export default () => resetTestDb();
