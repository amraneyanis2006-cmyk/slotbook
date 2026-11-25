import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { validateService, type ServiceInput } from '../rules/serviceRules.js';
import { now } from '../utils/clock.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'Service not found.');
const nameTaken = () => new AppError(409, 'SERVICE_NAME_TAKEN', 'A service with this name already exists.');

/** ServiceAdminView (F-11 §3): upcomingSlots = non-cancelled slots starting at or after now. */
async function toAdminView(ids?: number[]) {
  const services = await prisma.service.findMany({
    where: ids ? { id: { in: ids } } : undefined,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: {
      id: true, name: true, durationMin: true, isActive: true,
      _count: { select: { slots: { where: { status: { not: 'CANCELLED' }, startAt: { gte: now() } } } } },
    },
  });
  return services.map(({ _count, ...s }) => ({ ...s, upcomingSlots: _count.slots }));
}

export const listServices = () => toAdminView();

function validOrThrow(body: Record<string, unknown>, partial: boolean): ServiceInput {
  const result = validateService(body, { partial });
  if ('fields' in result) throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', result.fields);
  return result;
}

/** Case-insensitive uniqueness (F-11 §2), checked first for a clear 409 and guaranteed by the index service_name_ci. */
async function assertNameFree(name: string | undefined, exceptId?: number) {
  if (!name) return;
  const clash = await prisma.service.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, id: exceptId ? { not: exceptId } : undefined } });
  if (clash) throw nameTaken();
}
const uniqueRace = (err: unknown) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw nameTaken();
  throw err;
};
// A violation of service_name_ci (an expression index Prisma does not model) surfaces as a raw 23505 on lower(name).
const indexRace = (err: unknown) => {
  if (/lower\(name\)/.test(String((err as Error)?.message))) throw nameTaken();
  return uniqueRace(err);
};

export async function createService(body: Record<string, unknown>) {
  const { name, durationMin } = validOrThrow(body, false); // isActive is ignored: a new service is active (F-11 §1 step 3)
  await assertNameFree(name);
  const { id } = await prisma.service.create({ data: { name: name!, durationMin: durationMin! } }).catch(indexRace);
  return (await toAdminView([id]))[0];
}

export async function updateService(id: number, body: Record<string, unknown>) {
  if (!(await prisma.service.findUnique({ where: { id } }))) throw notFound();
  const data = validOrThrow(body, true);
  await assertNameFree(data.name, id);
  await prisma.service.update({ where: { id }, data }).catch(indexRace);
  return (await toAdminView([id]))[0];
}
