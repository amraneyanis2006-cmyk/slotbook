// SlotPublicView and BookingView of F-04 §3, shared by the customer pages.
export type SlotView = {
  id: number; startAt: string; endAt: string;
  service: { id: number; name: string; durationMin: number }; staff: { id: number; name: string };
};
export type BookingView = {
  reference: string; status: string; note: string | null; createdAt: string; cancelledAt: string | null; slot: SlotView;
};

const CANCEL_WINDOW_MS = 120 * 60_000; // BR-05

/** Comfort check mirroring BR-13/BR-05 with the browser clock; the server decides. */
export const canCancel = (booking: BookingView) =>
  booking.status === 'BOOKED' && new Date(booking.slot.startAt).getTime() - Date.now() >= CANCEL_WINDOW_MS;
