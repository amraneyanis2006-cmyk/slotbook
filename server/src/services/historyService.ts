import type { BookingStatus, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { isValidTransition, toHistoryView } from '../rules/historyRules.js';

type Tx = Prisma.TransactionClient;
export type StatusChange = {
  bookingId: number; from: BookingStatus | null; to: BookingStatus; actorId: number; reason?: string | null; at: Date;
};

/**
 * The only writer of BookingStatusChange (F-10 §1 step 3). Call it inside the transaction that changes the status,
 * so both commit or neither does. An impossible transition is a programming error (500, logged).
 */
export async function recordStatusChange(tx: Tx, { bookingId, from, to, actorId, reason = null, at }: StatusChange) {
  if (!isValidTransition(from, to)) throw new Error(`Invalid booking status change ${from} -> ${to}`);
  await tx.bookingStatusChange.create({ data: { bookingId, fromStatus: from, toStatus: to, actorId, reason, createdAt: at } });
}

/** HistoryEntry[] of one booking, oldest first (F-10 §3). */
export async function getHistory(bookingId: number) {
  const rows = await prisma.bookingStatusChange.findMany({
    where: { bookingId },
    select: { id: true, createdAt: true, fromStatus: true, toStatus: true, reason: true, actor: { select: { name: true, role: true } } },
  });
  return toHistoryView(rows);
}
