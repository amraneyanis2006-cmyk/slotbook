import type { BookingStatus, Role } from '@prisma/client';
import { formatBangkok } from '../utils/time.js';

type Change = { to: BookingStatus; reason: string | null };
type BookingInfo = { customerId: number; reference: string; startAt: Date };
type Actor = { id: number; name: string; role: Role };

const OUTCOME_LABEL: Partial<Record<BookingStatus, string>> = { COMPLETED: 'Completed', NO_SHOW: 'No-show' };

/**
 * F-16 §2: the notification for the customer of a booking whose status a Staff member changed, or null
 * (customer's own change, or a status that is not a cancellation or an outcome).
 */
export function notificationFor(change: Change, booking: BookingInfo, actor: Actor): { userId: number; message: string } | null {
  if (actor.role !== 'STAFF' || actor.id === booking.customerId) return null;
  const head = `Your booking ${booking.reference} on ${formatBangkok(booking.startAt)}`;
  if (change.to === 'CANCELLED') {
    return { userId: booking.customerId, message: `${head} was cancelled by ${actor.name}${change.reason ? `: ${change.reason}` : ''}.` };
  }
  const label = OUTCOME_LABEL[change.to];
  return label ? { userId: booking.customerId, message: `${head} was recorded as ${label}.` } : null;
}
