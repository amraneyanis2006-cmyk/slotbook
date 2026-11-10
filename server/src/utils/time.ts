// Asia/Bangkok is UTC+7 all year (no DST), so a fixed offset is exact.
const OFFSET = '+07:00';
const BANGKOK_MS = 7 * 60 * 60 * 1000;

/** Bangkok calendar date `YYYY-MM-DD` of a UTC instant. */
export const bangkokDate = (instant: Date): string =>
  new Date(instant.getTime() + BANGKOK_MS).toISOString().slice(0, 10);

/** UTC instant of a Bangkok local date + `HH:mm`. */
export const bangkokToUtc = (date: string, time: string): Date => new Date(`${date}T${time}:00${OFFSET}`);

/** `YYYY-MM-DD` shifted by whole days. */
export const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** True for a real calendar date written `YYYY-MM-DD` (the round-trip rejects dates such as 2030-02-30). */
export const isIsoDate = (date: string): boolean => {
  const day = new Date(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(day.getTime()) && day.toISOString().startsWith(date);
};
