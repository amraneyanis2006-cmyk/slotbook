// Pure staff-dashboard rules (F-15 §2, §3).
import type { BookingStatus, SlotStatus } from '@prisma/client';
import { addDays, isIsoDate } from '../utils/time.js';

export type DashboardSlot = {
  status: SlotStatus; startAt: Date; service: { id: number; name: string };
  booking: null | { status: Exclude<BookingStatus, 'CANCELLED'> };
};

/** Disjoint slot counts (as F-06), outcomes with pending = started BOOKED, no-show rate, bookings per service. */
export function computeDashboard(slots: DashboardSlot[], now: Date) {
  const booked = slots.filter((s) => s.booking);
  const count = (status: BookingStatus) => booked.filter((s) => s.booking!.status === status).length;
  const completed = count('COMPLETED');
  const noShow = count('NO_SHOW');
  const perService = new Map<number, { serviceId: number; name: string; bookings: number }>();
  for (const s of booked) {
    const row = perService.get(s.service.id) ?? { serviceId: s.service.id, name: s.service.name, bookings: 0 };
    row.bookings += 1;
    perService.set(s.service.id, row);
  }
  return {
    slots: {
      total: slots.length, booked: booked.length,
      open: slots.filter((s) => !s.booking && s.status === 'OPEN').length,
      closed: slots.filter((s) => !s.booking && s.status === 'CLOSED').length,
    },
    outcomes: { completed, noShow, pending: booked.filter((s) => s.booking!.status === 'BOOKED' && s.startAt <= now).length },
    noShowRate: completed + noShow ? Math.round((noShow / (completed + noShow)) * 1000) / 1000 : null,
    perService: [...perService.values()].sort((a, b) => b.bookings - a.bookings || a.name.localeCompare(b.name)),
  };
}

const DATE = 'Enter a valid date (YYYY-MM-DD).';
export const MAX_DASHBOARD_DAYS = 92;

/** `from`/`to` real dates, `to ≥ from`, at most 92 days (from + 91). */
export function validatePeriod(query: Record<string, unknown>): { from: string; to: string } | { fields: Record<string, string> } {
  const from = typeof query.from === 'string' && isIsoDate(query.from) ? query.from : null;
  const to = typeof query.to === 'string' && isIsoDate(query.to) ? query.to : null;
  if (!from || !to) return { fields: { ...(!from && { from: DATE }), ...(!to && { to: DATE }) } };
  if (to < from) return { fields: { to: 'The end date must be on or after the start date.' } };
  if (to > addDays(from, MAX_DASHBOARD_DAYS - 1)) return { fields: { to: `Choose a period of at most ${MAX_DASHBOARD_DAYS} days.` } };
  return { from, to };
}
