// SlotPublicView and BookingView of F-04 §3, shared by the customer pages.
export type SlotView = {
  id: number; startAt: string; endAt: string;
  service: { id: number; name: string; durationMin: number }; staff: { id: number; name: string };
};
export type BookingView = {
  reference: string; status: string; note: string | null; createdAt: string; cancelledAt: string | null; slot: SlotView;
};

const CANCEL_WINDOW_MS = 24 * 60 * 60_000; // BR-05 v2 (CR-01): 24 h

/** Comfort check mirroring BR-13/BR-05 with the browser clock; the server decides. */
export const canCancel = (booking: BookingView) =>
  booking.status === 'BOOKED' && new Date(booking.slot.startAt).getTime() - Date.now() >= CANCEL_WINDOW_MS;

// F-10 §3: one status change of a booking, oldest first in the arrays the API returns.
export type HistoryEntry = {
  at: string; from: string | null; to: string; actor: { name: string; role: 'CUSTOMER' | 'STAFF' }; reason: string | null;
};
/** StaffBookingView (F-10 §3): BookingView + the customer. */
export type StaffBookingView = BookingView & { customer: { id: number; name: string } };

/** The staff cancellation of a booking (F-07 cascade), whose reason the customer must see (FR-13). */
export const staffCancellation = (history: HistoryEntry[]) =>
  history.find((e) => e.to === 'CANCELLED' && e.actor.role === 'STAFF') ?? null;
