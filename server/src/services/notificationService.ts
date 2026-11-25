import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { now } from '../utils/clock.js';

const SELECT = { id: true, message: true, createdAt: true, readAt: true, booking: { select: { reference: true } } } as const;
type Row = { id: number; message: string; createdAt: Date; readAt: Date | null; booking: { reference: string } };
const view = ({ booking, ...n }: Row) => ({ id: n.id, message: n.message, bookingReference: booking.reference, createdAt: n.createdAt, readAt: n.readAt });
const unreadOf = (userId: number) => prisma.notification.count({ where: { userId, readAt: null } });

/** F-16 §3: the caller's last 50 notifications, newest first, with the unread count over all of them. */
export async function listNotifications(userId: number) {
  const rows = await prisma.notification.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50, select: SELECT });
  return { notifications: rows.map(view), unread: await unreadOf(userId) };
}

/** Mark one own notification as read; already read stays unchanged (F-16 §7); missing or another user's → 404. */
export async function markRead(userId: number, id: number) {
  const found = await prisma.notification.findFirst({ where: { id, userId }, select: SELECT });
  if (!found) throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  if (found.readAt) return { notification: view(found) };
  return { notification: view(await prisma.notification.update({ where: { id }, data: { readAt: now() }, select: SELECT })) };
}

export async function markAllRead(userId: number) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now() } });
  return { unread: await unreadOf(userId) };
}
