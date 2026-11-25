import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

const prisma = new PrismaClient();
afterAll(() => prisma.$disconnect());

describe('service name uniqueness (F-11 §5)', () => {
  it('DB-07: the unique index service_name_ci refuses a name that differs only in case', async () => {
    await expect(prisma.$executeRaw`INSERT INTO "Service" (name, "durationMin") VALUES ('ACADEMIC ADVISING', 30)`)
      .rejects.toThrow(/23505.*lower\(name\)/s);
    expect(await prisma.service.count({ where: { name: 'ACADEMIC ADVISING' } })).toBe(0);
  });
});
