import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { HistoryEntry, StaffBookingView } from '../api/bookings';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { HistoryList } from '../components/HistoryList';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { formatDay, formatTime, formatTimeRange } from '../utils/time';

/** Staff booking detail with history (F-10 §4): only bookings on the caller's own slots (others → 404). */
export default function StaffBookingPage() {
  const { reference = '' } = useParams();
  const [data, setData] = useState<{ booking: StaffBookingView; history: HistoryEntry[] } | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await http<{ booking: StaffBookingView; history: HistoryEntry[] }>(`/staff/bookings/${encodeURIComponent(reference)}`);
    if (res.ok) setData(res.data);
    else setError({ status: res.status, message: res.message });
  }, [reference]);
  useEffect(() => { load(); }, [load]);

  const back = <p><Link to="/staff/schedule">Back to Schedule</Link></p>;
  if (error?.status === 404) return <><h1>Booking not found.</h1>{back}</>;
  if (error) return <><h1>Booking {reference.toUpperCase()}</h1><Callout tone="error" onRetry={load}>{error.message}</Callout>{back}</>;
  if (!data) return <><h1>Booking {reference.toUpperCase()}</h1><Skeleton rows={4} label="Loading the booking" /></>;

  const { booking, history } = data;
  return (
    <>
      <h1>Booking {booking.reference}</h1>
      <div className="panel detail">
        <dl>
          <dt>Status</dt><dd><StatusBadge status={booking.status} /></dd>
          <dt>Customer</dt><dd>{booking.customer.name}</dd>
          <dt>Date and time</dt><dd>{formatDay(booking.slot.startAt)}, {formatTimeRange(booking.slot)}</dd>
          <dt>Service</dt><dd>{booking.slot.service.name}</dd>
          <dt>Note</dt><dd>{booking.note || '—'}</dd>
          <dt>Booked on</dt><dd>{formatDay(booking.createdAt)}, {formatTime(booking.createdAt)}</dd>
        </dl>
      </div>
      <HistoryList history={history} />
      {back}
    </>
  );
}
