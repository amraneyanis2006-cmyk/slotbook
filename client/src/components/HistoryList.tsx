import type { HistoryEntry } from '../api/bookings';
import { formatDay, formatTime } from '../utils/time';

const LABELS: Record<string, string> = { BOOKED: 'Booked', CANCELLED: 'Cancelled', COMPLETED: 'Completed', NO_SHOW: 'No-show' };
const ROLES = { CUSTOMER: 'Customer', STAFF: 'Staff' } as const;

/** Read-only booking history (F-10 §4), oldest first as returned by the API. */
export function HistoryList({ history }: { history: HistoryEntry[] }) {
  return (
    <section aria-labelledby="history-heading" className="panel">
      <h2 id="history-heading">History</h2>
      {history.length === 0
        ? <p className="hint">No history recorded.</p>
        : (
          <ol className="history">
            {history.map((e, i) => (
              <li key={i}>
                <time dateTime={e.at}>{formatDay(e.at)}, {formatTime(e.at)}</time>{' — '}
                <strong>{`${LABELS[e.to] ?? e.to} by ${e.actor.name} (${ROLES[e.actor.role]})`}</strong>
                {e.reason && <blockquote>{e.reason}</blockquote>}
              </li>
            ))}
          </ol>
        )}
    </section>
  );
}
