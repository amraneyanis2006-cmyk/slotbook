// Pure availability-template rules (F-14 §2, BR-18).
import type { SlotStatus } from '@prisma/client';
import { addDays, isIsoDate } from '../utils/time.js';
import { findOverlap, validateSlot, type SlotService, type TimeRange } from './slotRules.js';

export type TemplateEntryInput = { weekday: number; startTime: string; serviceId: number };
export const MAX_TEMPLATE_DAYS = 31;
const OVERLAP = 'You already have a slot at this time.';

/** ISO weekday of a YYYY-MM-DD date: 1 = Monday … 7 = Sunday. */
export const weekdayOf = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

/**
 * BR-18: one proposed slot per entry for every date of [from, to] with that weekday (dates in order, entries by start
 * time); each is checked with the F-03 rules (BR-06) and against the existing slots and the slots already accepted in
 * this run (BR-07). A failing slot is skipped with its reason, never created.
 */
export function planTemplateRun(entries: TemplateEntryInput[], from: string, to: string, services: Map<number, NonNullable<SlotService>>,
  existing: (TimeRange & { status: SlotStatus })[], now: Date) {
  const accept: (TemplateEntryInput & { date: string } & TimeRange)[] = [];
  const skipped: { date: string; startTime: string; serviceId: number; reason: string }[] = [];
  const sorted = [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let date = from; date <= to; date = addDays(date, 1)) {
    for (const e of sorted.filter((x) => x.weekday === weekdayOf(date))) {
      const range = validateSlot({ serviceId: e.serviceId, date, startTime: e.startTime }, services.get(e.serviceId) ?? null, now);
      if ('fields' in range) {
        skipped.push({ date, startTime: e.startTime, serviceId: e.serviceId, reason: range.fields.serviceId ?? range.fields.date ?? range.fields.startTime });
      } else if (findOverlap(range, [...existing, ...accept.map((a) => ({ ...a, status: 'OPEN' as const }))])) {
        skipped.push({ date, startTime: e.startTime, serviceId: e.serviceId, reason: OVERLAP });
      } else accept.push({ ...e, date, ...range });
    }
  }
  return { accept, skipped };
}

/** Template body (F-14 §3): name 3–60, 1–50 entries, weekday 1–7, time on a 15-minute step, positive service id, no duplicate weekday + time. */
export function validateTemplate(input: Record<string, unknown>): { name: string; entries: TemplateEntryInput[] } | { fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 3 || name.length > 60) fields.name = 'Enter a name of 3 to 60 characters.';
  const list = Array.isArray(input.entries) ? input.entries : [];
  if (list.length < 1 || list.length > 50) fields.entries = 'Add 1 to 50 entries.';
  const entries: TemplateEntryInput[] = [];
  if (!fields.entries) {
    list.forEach((raw, i) => {
      const e = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      if (!Number.isInteger(e.weekday) || (e.weekday as number) < 1 || (e.weekday as number) > 7) fields[`entries.${i}.weekday`] = 'Choose a weekday.';
      if (typeof e.startTime !== 'string' || !/^([01]\d|2[0-3]):(00|15|30|45)$/.test(e.startTime)) fields[`entries.${i}.startTime`] = 'Choose a start time on a 15-minute step (HH:mm).';
      if (!Number.isInteger(e.serviceId) || (e.serviceId as number) < 1) fields[`entries.${i}.serviceId`] = 'Choose an active service.';
      entries.push({ weekday: e.weekday as number, startTime: e.startTime as string, serviceId: e.serviceId as number });
    });
    if (!Object.keys(fields).length && new Set(entries.map((e) => `${e.weekday} ${e.startTime}`)).size !== entries.length) {
      fields.entries = 'Each weekday and time can appear only once.';
    }
  }
  return Object.keys(fields).length ? { fields } : { name, entries };
}

/** Generate range (F-14 §3): real dates, to ≥ from, at most 31 days. */
export function validateRange(input: Record<string, unknown>): { from: string; to: string } | { fields: Record<string, string> } {
  const DATE = 'Enter a valid date (YYYY-MM-DD).';
  const from = typeof input.from === 'string' && isIsoDate(input.from) ? input.from : null;
  const to = typeof input.to === 'string' && isIsoDate(input.to) ? input.to : null;
  if (!from || !to) return { fields: { ...(!from && { from: DATE }), ...(!to && { to: DATE }) } };
  if (to < from) return { fields: { to: 'The end date must be on or after the start date.' } };
  if (to > addDays(from, MAX_TEMPLATE_DAYS - 1)) return { fields: { to: `Generate at most ${MAX_TEMPLATE_DAYS} days at a time.` } };
  return { from, to };
}
