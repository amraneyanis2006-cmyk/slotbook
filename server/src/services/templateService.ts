import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { planTemplateRun, validateRange, validateTemplate } from '../rules/templateRules.js';
import { now } from '../utils/clock.js';
import { addDays, bangkokToUtc } from '../utils/time.js';
import { SLOT_STAFF_INCLUDE, toSlotStaffView } from './slotService.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'Template not found.');
const invalid = (fields: Record<string, string>) => new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', fields);
const INCLUDE = { entries: { orderBy: [{ weekday: 'asc' as const }, { startTime: 'asc' as const }], include: { service: { select: { id: true, name: true, durationMin: true } } } } };
const view = (t: { id: number; name: string; entries: { weekday: number; startTime: string; service: { id: number; name: string; durationMin: number } }[] }) =>
  ({ id: t.id, name: t.name, entries: t.entries.map((e) => ({ weekday: e.weekday, startTime: e.startTime, service: e.service })) });

/** Validated body whose services all exist and are active (F-14 §3). */
async function checkedBody(raw: Record<string, unknown>) {
  const body = validateTemplate(raw);
  if ('fields' in body) throw invalid(body.fields);
  const active = new Set((await prisma.service.findMany({ where: { isActive: true }, select: { id: true } })).map((s) => s.id));
  const fields: Record<string, string> = {};
  body.entries.forEach((e, i) => { if (!active.has(e.serviceId)) fields[`entries.${i}.serviceId`] = 'Choose an active service.'; });
  if (Object.keys(fields).length) throw invalid(fields);
  return body;
}
async function own(staffId: number, id: number) {
  const t = await prisma.availabilityTemplate.findFirst({ where: { id, staffId } });
  if (!t) throw notFound();
  return t;
}

export const listTemplates = async (staffId: number) =>
  (await prisma.availabilityTemplate.findMany({ where: { staffId }, orderBy: { name: 'asc' }, include: INCLUDE })).map(view);

export async function createTemplate(staffId: number, raw: Record<string, unknown>) {
  const { name, entries } = await checkedBody(raw);
  return view(await prisma.availabilityTemplate.create({ data: { staffId, name, entries: { create: entries } }, include: INCLUDE }));
}

export async function updateTemplate(staffId: number, id: number, raw: Record<string, unknown>) {
  await own(staffId, id);
  const { name, entries } = await checkedBody(raw);
  return view(await prisma.$transaction(async (tx) => {
    await tx.templateEntry.deleteMany({ where: { templateId: id } });
    return tx.availabilityTemplate.update({ where: { id }, data: { name, entries: { create: entries } }, include: INCLUDE });
  }));
}

export async function deleteTemplate(staffId: number, id: number) {
  await own(staffId, id);
  await prisma.availabilityTemplate.delete({ where: { id } }); // entries cascade; generated slots are not touched
}

/**
 * F-14 §1 steps 2–3 (BR-18): under the staff row lock of F-03, plan the run against the staff member's existing slots
 * and create all accepted slots in the same transaction; skipped slots are returned with their reason.
 */
export async function generate(staffId: number, id: number, raw: Record<string, unknown>) {
  const range = validateRange(raw);
  if ('fields' in range) throw invalid(range.fields);
  const template = await prisma.availabilityTemplate.findFirst({ where: { id, staffId }, include: { entries: true } });
  if (!template) throw notFound();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${staffId} FOR UPDATE`;
    const at = now();
    const services = new Map((await tx.service.findMany()).map((s) => [s.id, s]));
    const existing = await tx.slot.findMany({
      where: { staffId, status: { not: 'CANCELLED' }, startAt: { lt: bangkokToUtc(addDays(range.to, 1), '00:00') }, endAt: { gt: bangkokToUtc(range.from, '00:00') } },
    });
    const plan = planTemplateRun(template.entries, range.from, range.to, services, existing, at);
    const created = [];
    for (const a of plan.accept) {
      created.push(toSlotStaffView(await tx.slot.create({ data: { staffId, serviceId: a.serviceId, startAt: a.startAt, endAt: a.endAt }, include: SLOT_STAFF_INCLUDE })));
    }
    const skipped = plan.skipped.map(({ serviceId, ...s }) => ({ ...s, service: { id: serviceId, name: services.get(serviceId)?.name ?? '' } }))
      .map(({ date, startTime, service, reason }) => ({ date, startTime, service, reason }));
    return { created, skipped };
  });
}
