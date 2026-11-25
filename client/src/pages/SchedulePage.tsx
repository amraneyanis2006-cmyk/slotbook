import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { EmptyState } from '../components/EmptyState';
import { OutcomeButtons } from '../components/OutcomeButtons';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';
import { addDays, formatDay, formatTimeRange, todayBangkok } from '../utils/time';

type ScheduleSlot = {
  id: number; startAt: string; endAt: string; status: string;
  service: { id: number; name: string; durationMin: number };
  booking: null | {
    reference: string; status: string; note: string | null; customer: { id: number; name: string }; canRecordOutcome?: boolean;
  };
};
type Schedule = { date: string; slots: ScheduleSlot[]; summary: { total: number; booked: number; open: number; closed: number } };

const summaryLine = ({ total, booked, open, closed }: Schedule['summary']) =>
  `${total} ${total === 1 ? 'slot' : 'slots'} · ${booked} booked · ${open} open · ${closed} closed`;

export default function SchedulePage() {
  const [date, setDate] = useState(todayBangkok());
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setError(null);
    setSchedule(null);
    if (!date) return; // the date input is being edited
    const res = await http<Schedule>(`/staff/schedule?date=${date}`);
    if (request !== latest.current) return; // another day is loading
    if (res.ok) setSchedule(res.data);
    else setError(res.message);
  }, [date]);
  useEffect(() => { load(); }, [load]);
  // Reload after an outcome without the loading skeleton, so focus and scroll stay in place.
  const refresh = async () => {
    const res = await http<Schedule>(`/staff/schedule?date=${date}`);
    if (res.ok) setSchedule(res.data);
  };

  return (
    <>
      <h1>Schedule</h1>
      {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}
      {actionError && <Callout tone="error">{actionError}</Callout>}
      <div className="day-picker">
        <button type="button" className="secondary" disabled={!date} onClick={() => setDate(addDays(date, -1))}>Previous day</button>
        <div>
          <label htmlFor="date">Date</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button type="button" className="secondary" disabled={!date} onClick={() => setDate(addDays(date, 1))}>Next day</button>
      </div>

      <section aria-labelledby="schedule-title">
        <h2 id="schedule-title">{date ? formatDay(`${date}T12:00:00+07:00`) : 'Choose a date'}</h2>
        {!date ? <p className="muted">Choose a date to see its slots.</p>
          : error ? <Callout tone="error" onRetry={load}>{error}</Callout>
          : schedule === null ? <Skeleton label="Loading the schedule" />
            : schedule.slots.length === 0
              ? <EmptyState message="No slots on this day."><Link to="/staff/slots">My Slots</Link></EmptyState>
              : (
                <>
                  <p className="summary">{summaryLine(schedule.summary)}</p>
                  <table className="responsive-table">
                    <thead><tr><th>Time</th><th>Service</th><th>Status</th><th>Booking</th><th>Customer</th><th>Note</th><th>Outcome</th></tr></thead>
                    <tbody>
                      {schedule.slots.map((slot) => (
                        <tr key={slot.id}>
                          <td data-label="Time">{formatTimeRange(slot)}</td>
                          <td data-label="Service">{slot.service.name}</td>
                          <td data-label="Status"><StatusBadge status={slot.booking?.status ?? slot.status} /></td>
                          <td data-label="Booking">{slot.booking ? <Link to={`/staff/bookings/${slot.booking.reference}`}>{slot.booking.reference}</Link> : '—'}</td>
                          <td data-label="Customer">{slot.booking?.customer.name ?? '—'}</td>
                          <td data-label="Note">{slot.booking?.note || '—'}</td>
                          <td data-label="Outcome">
                            {slot.booking?.canRecordOutcome
                              ? <OutcomeButtons reference={slot.booking.reference} customer={slot.booking.customer.name}
                                  onDone={() => { setActionError(null); setToast({ id: Date.now(), message: 'Outcome recorded' }); refresh(); }}
                                  onError={(message) => { setActionError(message); refresh(); }} />
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
      </section>
    </>
  );
}
