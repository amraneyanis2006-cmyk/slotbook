import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { formatDay, formatTime } from '../utils/time';

type Notification = { id: number; message: string; bookingReference: string; createdAt: string; readAt: string | null };
export const NOTIFICATIONS_CHANGED = 'slotbook:notifications-changed';

// F-16 §4: the customer's notifications, newest first, unread in bold; Mark as read / Mark all as read.
export default function NotificationsPage() {
  const [data, setData] = useState<{ notifications: Notification[]; unread: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await http<{ notifications: Notification[]; unread: number }>('/notifications');
    if (res.ok) setData(res.data);
    else setError(res.message);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function mark(path: string) {
    setBusy(true);
    const res = await http(path, { method: 'POST', body: {} });
    setBusy(false);
    if (!res.ok) setError(res.message);
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)); // the header refreshes its count
    load();
  }

  return (
    <>
      <h1>Notifications</h1>
      {error && <Callout tone="error" onRetry={load}>{error}</Callout>}
      {data === null ? (!error && <Skeleton label="Loading the notifications" />) : data.notifications.length === 0 ? <EmptyState message="No notifications yet." /> : (
        <>
          <div className="filters">
            <p className="summary">{data.unread ? `${data.unread} unread` : 'All read'}</p>
            <button type="button" className="secondary" disabled={busy || data.unread === 0} onClick={() => mark('/notifications/read-all')}>Mark all as read</button>
          </div>
          <ul className="notifications">
            {data.notifications.map((n) => (
              <li key={n.id} className={n.readAt ? undefined : 'unread'}>
                {!n.readAt && <span className="badge">Unread</span>}
                <p>{n.message}</p>
                <p className="hint">{formatDay(n.createdAt)}, {formatTime(n.createdAt)} · <Link to={`/bookings/${n.bookingReference}`} aria-label={`View booking ${n.bookingReference}`}>View booking</Link></p>
                {!n.readAt && <button type="button" className="secondary" disabled={busy} onClick={() => mark(`/notifications/${n.id}/read`)}>Mark as read</button>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
