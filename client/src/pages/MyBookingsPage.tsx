import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BookingView } from '../api/bookings';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { formatDay, formatTimeRange } from '../utils/time';

type Mine = { upcoming: BookingView[]; past: BookingView[] };

function BookingTable({ id, title, bookings, none }: { id: string; title: string; bookings: BookingView[]; none: string }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {bookings.length === 0 ? <p className="muted">{none}</p> : (
        <table className="responsive-table">
          <thead>
            <tr><th>Reference</th><th>Date</th><th>Time</th><th>Service</th><th>Staff</th><th>Status</th><th><span className="visually-hidden">Details</span></th></tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.reference}>
                <td data-label="Reference">{b.reference}</td>
                <td data-label="Date">{formatDay(b.slot.startAt)}</td>
                <td data-label="Time">{formatTimeRange(b.slot)}</td>
                <td data-label="Service">{b.slot.service.name}</td>
                <td data-label="Staff">{b.slot.staff.name}</td>
                <td data-label="Status"><StatusBadge status={b.status} /></td>
                <td><Link to={`/bookings/${b.reference}`} aria-label={`View ${b.reference}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function MyBookingsPage() {
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read from the server on every visit (F-05 §1 step 6).
  const load = useCallback(async () => {
    setError(null);
    setMine(null);
    const res = await http<Mine>('/bookings/mine');
    if (res.ok) setMine(res.data);
    else setError(res.message);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <h1>My Bookings</h1>
      {error ? <Callout tone="error" onRetry={load}>{error}</Callout>
        : mine === null ? <Skeleton label="Loading your bookings" />
          : mine.upcoming.length + mine.past.length === 0
            ? <EmptyState message="You have no bookings yet."><Link to="/book">Book a slot.</Link></EmptyState>
            : (
              <>
                <BookingTable id="upcoming-title" title="Upcoming" bookings={mine.upcoming} none="No upcoming bookings." />
                <BookingTable id="past-title" title="Past and cancelled" bookings={mine.past} none="No past or cancelled bookings." />
              </>
            )}
    </>
  );
}
