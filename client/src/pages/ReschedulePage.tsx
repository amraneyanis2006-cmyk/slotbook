import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { canCancel, type BookingView, type SlotView } from '../api/bookings';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { addDays, formatDay, formatTime, formatTimeRange, todayBangkok } from '../utils/time';

const bangkokDate = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);
const at = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

// F-08 §4: move a booking to another bookable slot of the same service.
export default function ReschedulePage() {
  const { reference = '' } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<SlotView[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<SlotView | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    setLoadError(null);
    const res = await http<{ booking: BookingView }>(`/bookings/${encodeURIComponent(reference)}`);
    if (res.ok) { setBooking(res.data.booking); setDate((d) => d || bangkokDate(res.data.booking.slot.startAt)); }
    else setLoadError({ status: res.status, message: res.message });
  }, [reference]);
  useEffect(() => { loadBooking(); }, [loadBooking]);

  const loadSlots = useCallback(async () => {
    if (!booking || !date) return;
    setSlots(null);
    setSlotsError(null);
    setChosen(null);
    const res = await http<{ slots: SlotView[] }>(`/slots/available?date=${date}&serviceId=${booking.slot.service.id}`);
    if (res.ok) setSlots(res.data.slots.filter((s) => s.id !== booking.slot.id));
    else setSlotsError(res.message);
  }, [booking, date]);
  useEffect(() => { loadSlots(); }, [loadSlots]);

  async function move() {
    if (!booking || !chosen) return;
    setBusy(true);
    setMoveError(null);
    const res = await http<{ booking: BookingView; previous: string }>(`/bookings/${booking.reference}/reschedule`, { method: 'POST', body: { slotId: chosen.id } });
    setBusy(false);
    setConfirming(false);
    if (res.ok) {
      navigate(`/bookings/${res.data.booking.reference}`, { state: { toast: `Booking moved to ${at(res.data.booking.slot.startAt)}` } });
    } else {
      setMoveError(res.fields?.slotId ?? res.message);
      loadSlots();
    }
  }

  const back = <p><Link to={`/bookings/${encodeURIComponent(reference)}`}>Back to the booking</Link></p>;
  if (loadError?.status === 404) return <><h1>Booking not found.</h1><p><Link to="/bookings">Back to My Bookings</Link></p></>;
  if (loadError) return <><h1>Reschedule {reference.toUpperCase()}</h1><Callout tone="error" onRetry={loadBooking}>{loadError.message}</Callout></>;
  if (!booking) return <><h1>Reschedule {reference.toUpperCase()}</h1><Skeleton rows={4} label="Loading the booking" /></>;
  if (!canCancel(booking)) {
    return <><h1>Reschedule {booking.reference}</h1><Callout>This booking can no longer be moved. Changes close 24 hours before the start.</Callout>{back}</>;
  }

  return (
    <>
      <h1>Reschedule {booking.reference}</h1>
      <p>Now: {at(booking.slot.startAt)}, {booking.slot.service.name} with {booking.slot.staff.name}</p>
      {moveError && <Callout tone="error">{moveError}</Callout>}
      <div className="day-picker">
        <button type="button" className="secondary" disabled={!date || date <= todayBangkok()} onClick={() => setDate(addDays(date, -1))}>Previous day</button>
        <div>
          <label htmlFor="date">Date</label>
          <input id="date" type="date" min={todayBangkok()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button type="button" className="secondary" disabled={!date} onClick={() => setDate(addDays(date, 1))}>Next day</button>
      </div>

      <section aria-labelledby="slots-title">
        <h2 id="slots-title">Other {booking.slot.service.name} slots{date ? ` on ${formatDay(`${date}T12:00:00+07:00`)}` : ''}</h2>
        {slotsError ? <Callout tone="error" onRetry={loadSlots}>{slotsError}</Callout>
          : slots === null ? <Skeleton label="Loading the slots" />
            : slots.length === 0 ? <EmptyState message="No other slot of this service on this day. Try another date." />
              : (
                <fieldset className="slot-choices">
                  <legend>Choose a new time</legend>
                  {slots.map((s) => (
                    <label key={s.id} className="choice">
                      <input type="radio" name="slot" value={s.id} checked={chosen?.id === s.id} onChange={() => setChosen(s)} />
                      {formatTimeRange(s)} · {s.staff.name}
                    </label>
                  ))}
                </fieldset>
              )}
        <button type="button" disabled={!chosen} onClick={() => setConfirming(true)}>Move booking</button>
      </section>
      {back}

      {confirming && chosen && (
        <ConfirmDialog title="Move this booking?" onCancel={() => { if (!busy) setConfirming(false); }}>
          <p>Move your booking from {at(booking.slot.startAt)} to {at(chosen.startAt)} with {chosen.staff.name}?</p>
          <div className="dialog-actions">
            <button type="button" onClick={move} disabled={busy}>Yes, move booking</button>
            <button type="button" className="secondary" onClick={() => setConfirming(false)} disabled={busy}>Keep current time</button>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
