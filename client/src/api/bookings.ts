// BookingView of F-04 §3, shared by the booking pages.
export type BookingView = {
  reference: string; status: string; note: string | null; createdAt: string; cancelledAt: string | null;
  slot: {
    id: number; startAt: string; endAt: string;
    service: { id: number; name: string; durationMin: number }; staff: { id: number; name: string };
  };
};

/** Comfort check mirroring BR-13/BR-05 (the server decides): BOOKED and starting in ≥ 2 h. */
export const canCancel = (booking: BookingView) =>
  booking.status === 'BOOKED' && new Date(booking.slot.startAt).getTime() - Date.now() >= 120 * 60_000;
