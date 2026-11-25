import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { now } from '../utils/clock.js';
import { suspensionOf } from './bookingService.js';
import { recordStatusChange } from './historyService.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'Account not found.');
const DAY_MS = 24 * 3_600_000;

/** F-17 §3: customer accounts by name with status, suspension, active future bookings and no-shows of the last 30 days. */
export async function listCustomers(q?: string) {
  const at = now();
  const users = await prisma.user.findMany({
    where: { role: 'CUSTOMER', ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}) },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true, name: true, email: true, isActive: true,
      bookings: { where: { status: 'BOOKED', slot: { startAt: { gt: at } } }, orderBy: { slot: { startAt: 'asc' } }, select: { reference: true } },
    },
  });
  return Promise.all(users.map(async ({ bookings, ...u }) => {
    const until = await suspensionOf(prisma, u.id, at);
    const noShows30d = await prisma.bookingStatusChange.count({
      where: { toStatus: 'NO_SHOW', booking: { customerId: u.id }, createdAt: { gt: new Date(at.getTime() - 30 * DAY_MS), lte: at } },
    });
    return { ...u, suspendedUntil: until, activeBookings: bookings.length, activeBookingRefs: bookings.map((b) => b.reference), noShows30d };
  }));
}

const view = (u: { id: number; name: string; email: string; isActive: boolean }) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive });

/**
 * F-17 §1 step 2 (Q-03, BR-17): one transaction locks the customer, deactivates the account and cancels every BOOKED
 * booking that has not started, by the staff member, with the reason "account deactivated" and a history row.
 */
export function deactivateCustomer(staffId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "User" WHERE id = ${userId} AND role = 'CUSTOMER' FOR UPDATE`;
    if (!locked) throw notFound();
    const at = now();
    const user = await tx.user.update({ where: { id: userId }, data: { isActive: false } });
    const future = await tx.booking.findMany({ where: { customerId: userId, status: 'BOOKED', slot: { startAt: { gt: at } } }, select: { id: true, reference: true } });
    for (const b of future) {
      await tx.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED', cancelledAt: at, cancelledById: staffId } });
      await recordStatusChange(tx, { bookingId: b.id, from: 'BOOKED', to: 'CANCELLED', actorId: staffId, reason: 'account deactivated', at });
    }
    return { user: view(user), cancelledBookings: future.map((b) => b.reference) };
  });
}

/** F-17: reactivation restores login only; cancelled bookings stay cancelled. */
export async function reactivateCustomer(userId: number) {
  const found = await prisma.user.findFirst({ where: { id: userId, role: 'CUSTOMER' } });
  if (!found) throw notFound();
  return { user: view(await prisma.user.update({ where: { id: userId }, data: { isActive: true } })) };
}
