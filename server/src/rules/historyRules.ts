// Pure booking-history rules (F-10 §2).
import type { BookingStatus, Role } from '@prisma/client';

/** The only status changes any feature may record (F-10 §1 step 2). */
const ALLOWED = new Set(['null>BOOKED', 'BOOKED>CANCELLED', 'BOOKED>COMPLETED', 'BOOKED>NO_SHOW']);
export const isValidTransition = (from: BookingStatus | null, to: BookingStatus): boolean => ALLOWED.has(`${from}>${to}`);

export type HistoryRow = {
  id: number; createdAt: Date; fromStatus: BookingStatus | null; toStatus: BookingStatus; reason: string | null;
  actor: { name: string; role: Role };
};
export type HistoryEntry = { at: Date; from: BookingStatus | null; to: BookingStatus; actor: { name: string; role: Role }; reason: string | null };

/** Oldest first (createdAt, then id); name and role of the actor only, never an e-mail or id. */
export const toHistoryView = (rows: HistoryRow[]): HistoryEntry[] =>
  [...rows]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)
    .map((r) => ({ at: r.createdAt, from: r.fromStatus, to: r.toStatus, actor: { name: r.actor.name, role: r.actor.role }, reason: r.reason }));
