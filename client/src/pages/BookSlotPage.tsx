import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { formatDay, formatTime, todayBangkok } from '../utils/time';

type Service = { id: number; name: string; durationMin: number };
type SlotPublicView = { id: number; startAt: string; endAt: string; service: Service; staff: { id: number; name: string } };
type Booking = { reference: string };

const NOTE_MAX = 300;
const timeRange = (slot: SlotPublicView) => `${formatTime(slot.startAt)}–${formatTime(slot.endAt)}`;

export default function BookSlotPage() {
  const [date, setDate] = useState(todayBangkok());
  const [serviceId, setServiceId] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<SlotPublicView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SlotPublicView | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booking | null>(null);
  const latest = useRef(0);
  const successLink = useRef<HTMLAnchorElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    http<{ services: Service[] }>('/services').then((res) => { if (res.ok) setServices(res.data.services); });
  }, []);

  /** Loads the list; a refresh after a booking attempt keeps the current list on screen (no skeleton). */
  const loadSlots = useCallback(async (refresh = false) => {
    const request = ++latest.current;
    if (!date) return; // the date input is being edited
    setLoadError(null);
    if (!refresh) setSlots(null);
    const query = new URLSearchParams({ date, ...(serviceId && { serviceId }) });
    const res = await http<{ slots: SlotPublicView[] }>(`/slots/available?${query}`);
    if (request !== latest.current) return; // a newer filter is loading
    if (res.ok) setSlots(res.data.slots);
    else setLoadError(res.message);
  }, [date, serviceId]);

  useEffect(() => { loadSlots(); }, [loadSlots]);
  useEffect(() => { if (booked) successLink.current?.focus(); }, [booked]); // the Confirm button is gone
  useEffect(() => { if (bookError) confirmButton.current?.focus(); }, [bookError]); // it was disabled while busy
  // After the dialog closes, focus returns to its Book button; if that slot left the list, to the list heading.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !selected && document.activeElement === document.body) listHeading.current?.focus();
    wasOpen.current = !!selected;
  }, [selected]);

  const open = (slot: SlotPublicView) => {
    setSelected(slot);
    setNote('');
    setBookError(null);
    setBooked(null);
  };
  const close = () => { if (!busy) setSelected(null); };

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setBookError(null);
    const res = await http<{ booking: Booking }>('/bookings', { method: 'POST', body: { slotId: selected.id, note } });
    setBusy(false);
    if (res.ok) setBooked(res.data.booking);
    else setBookError(res.fields ? Object.values(res.fields).join(' ') : res.message);
    if (res.ok || res.status === 404 || res.status === 409) loadSlots(true);
  }

  return (
    <>
      <h1>Book a Slot</h1>
      <div className="filters">
        <div>
          <label htmlFor="date">Date</label>
          <input id="date" type="date" min={todayBangkok()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="serviceId">Service</label>
          <select id="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">All services</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <section aria-labelledby="available-title">
        <h2 id="available-title" ref={listHeading} tabIndex={-1}>Available slots{date && ` · ${formatDay(`${date}T12:00:00+07:00`)}`}</h2>
        {loadError ? <Callout tone="error" onRetry={() => loadSlots()}>{loadError}</Callout>
          : slots === null ? <Skeleton label="Loading available slots" />
            : slots.length === 0 ? <EmptyState message="No available slots on this day. Try another date." />
              : (
                <ul className="slot-list">
                  {slots.map((slot) => (
                    <li key={slot.id} className="slot-card">
                      <p className="slot-time">{timeRange(slot)}</p>
                      <p>{slot.service.name}</p>
                      <p className="muted">{slot.staff.name}</p>
                      <button type="button" aria-label={`Book ${formatTime(slot.startAt)} ${slot.service.name} with ${slot.staff.name}`} onClick={() => open(slot)}>
                        Book
                      </button>
                    </li>
                  ))}
                </ul>
              )}
      </section>

      {selected && (
        <ConfirmDialog title="Confirm booking" onCancel={close}>
          <p>
            {formatDay(selected.startAt)}, {timeRange(selected)}<br />
            {selected.service.name} with {selected.staff.name}
          </p>
          {booked ? (
            <>
              <Callout>Booked! Reference {booked.reference}</Callout>
              <div className="dialog-actions">
                <Link to="/bookings" ref={successLink}>Go to My Bookings</Link>
                <button type="button" className="secondary" onClick={close}>Close</button>
              </div>
            </>
          ) : (
            <>
              <label htmlFor="note">Note (optional)</label>
              <textarea id="note" rows={3} maxLength={NOTE_MAX} value={note} aria-describedby="note-count" onChange={(e) => setNote(e.target.value)} />
              <p id="note-count" className="hint">{note.length}/{NOTE_MAX}</p>
              {bookError && <Callout tone="error">{bookError}</Callout>}
              <div className="dialog-actions">
                <button type="button" ref={confirmButton} onClick={confirm} disabled={busy}>Confirm booking</button>
                <button type="button" className="secondary" onClick={close} disabled={busy}>Cancel</button>
              </div>
            </>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
