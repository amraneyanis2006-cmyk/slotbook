import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { canCancel, type BookingView } from '../api/bookings';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';
import { formatDay, formatTime, formatTimeRange } from '../utils/time';

const at = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

export default function BookingDetailPage() {
  const { reference = '' } = useParams();
  const path = `/bookings/${encodeURIComponent(reference)}`;
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // After a cancellation attempt the Cancel button may be gone: focus the page heading instead of losing it.
  useEffect(() => { if (toast || pageError) heading.current?.focus(); }, [toast, pageError]);

  const load = useCallback(async () => {
    setError(null);
    const res = await http<{ booking: BookingView }>(path);
    if (res.ok) setBooking(res.data.booking);
    else setError({ status: res.status, message: res.message });
  }, [path]);
  useEffect(() => { load(); }, [load]);

  async function cancel() {
    if (busy) return;
    setBusy(true);
    setPageError(null);
    const res = await http<{ booking: BookingView }>(`${path}/cancel`, { method: 'POST', body: {} });
    setBusy(false);
    setConfirming(false);
    if (res.ok) {
      setBooking(res.data.booking);
      setToast({ id: Date.now(), message: 'Booking cancelled' });
    } else {
      setPageError(res.message);
      load(); // show the current status
    }
  }
  const closeDialog = () => { if (!busy) setConfirming(false); };

  const back = <p><Link to="/bookings">Back to My Bookings</Link></p>;
  if (error?.status === 404) return <><h1>Booking not found.</h1>{back}</>;
  if (error) return <><h1>Booking {reference.toUpperCase()}</h1><Callout tone="error" onRetry={load}>{error.message}</Callout>{back}</>;
  if (!booking) return <><h1>Booking {reference.toUpperCase()}</h1><Skeleton rows={4} label="Loading the booking" /></>;

  return (
    <>
      <h1 ref={heading} tabIndex={-1}>Booking {booking.reference}</h1>
      {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}
      {pageError && <Callout tone="error">{pageError}</Callout>}
      <div className="panel detail">
        <dl>
          <dt>Status</dt><dd><StatusBadge status={booking.status} /></dd>
          <dt>Date and time</dt><dd>{formatDay(booking.slot.startAt)}, {formatTimeRange(booking.slot)}</dd>
          <dt>Service</dt><dd>{booking.slot.service.name}</dd>
          <dt>Staff</dt><dd>{booking.slot.staff.name}</dd>
          <dt>Note</dt><dd>{booking.note || '—'}</dd>
          <dt>Booked on</dt><dd>{at(booking.createdAt)}</dd>
          {booking.cancelledAt && <><dt>Cancelled on</dt><dd>{at(booking.cancelledAt)}</dd></>}
        </dl>
        {canCancel(booking)
          ? <button type="button" onClick={() => { setPageError(null); setConfirming(true); }}>Cancel booking</button>
          : booking.status === 'BOOKED' && <p className="hint">Cancellation closes 2 hours before the start.</p>}
      </div>
      {back}

      {confirming && (
        <ConfirmDialog title="Cancel this booking?" onCancel={closeDialog}>
          <p>{booking.reference}: {booking.slot.service.name} with {booking.slot.staff.name}, {at(booking.slot.startAt)}</p>
          <div className="dialog-actions">
            <button type="button" onClick={cancel} disabled={busy}>Yes, cancel booking</button>
            <button type="button" className="secondary" onClick={closeDialog} disabled={busy}>Keep booking</button>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
