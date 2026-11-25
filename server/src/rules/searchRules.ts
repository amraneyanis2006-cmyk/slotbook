// Pure slot-search rules (F-12 §2).
import { addDays, isIsoDate } from '../utils/time.js';

export const MAX_SEARCH_DAYS = 14;
export const MAX_SEARCH_RESULTS = 200;
export type SearchQuery = { from: string; to: string; serviceId?: number; staffId?: number };

const DATE = 'Enter a valid date (YYYY-MM-DD).';
const positiveId = (raw: unknown) => (typeof raw === 'string' && /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : null);

/** from/to real dates, to ≥ from, at most 14 days (from + 13); optional positive ids. A past `from` is allowed. */
export function validateSearch(query: Record<string, unknown>): SearchQuery | { fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  const from = typeof query.from === 'string' && isIsoDate(query.from) ? query.from : null;
  const to = typeof query.to === 'string' && isIsoDate(query.to) ? query.to : null;
  if (!from) fields.from = DATE;
  if (!to) fields.to = DATE;
  if (from && to && to < from) fields.to = 'The end date must be on or after the start date.';
  else if (from && to && to > addDays(from, MAX_SEARCH_DAYS - 1)) fields.to = `Search at most ${MAX_SEARCH_DAYS} days at a time.`;
  const serviceId = query.serviceId === undefined ? undefined : positiveId(query.serviceId);
  const staffId = query.staffId === undefined ? undefined : positiveId(query.staffId);
  if (serviceId === null) fields.serviceId = 'Choose a valid service.';
  if (staffId === null) fields.staffId = 'Choose a valid staff member.';
  if (Object.keys(fields).length) return { fields };
  return { from: from!, to: to!, ...(serviceId && { serviceId }), ...(staffId && { staffId }) };
}
