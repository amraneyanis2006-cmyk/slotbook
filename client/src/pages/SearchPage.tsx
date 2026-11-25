import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SlotView } from '../api/bookings';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { addDays, formatDay, formatTime, formatTimeRange, todayBangkok } from '../utils/time';

type Option = { id: number; name: string };
type Result = { slots: SlotView[]; truncated: boolean };
const NOTE_MAX = 300;
const bangkokDate = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

// F-12 §1/§4: Find a Slot — bookable slots over a date range, by service and staff; the search lives in the URL.
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = {
    from: params.get('from') ?? todayBangkok(), to: params.get('to') ?? addDays(todayBangkok(), 6),
    serviceId: params.get('serviceId') ?? '', staffId: params.get('staffId') ?? '',
  };
  const queryKey = new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString();
  const [form, setForm] = useState(query);
  const [services, setServices] = useState<Option[]>([]);
  const [staff, setStaff] = useState<Option[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SlotView | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  useEffect(() => {
    http<{ services: Option[] }>('/services').then((res) => { if (res.ok) setServices(res.data.services); });
    http<{ staff: Option[] }>('/staff-members').then((res) => { if (res.ok) setStaff(res.data.staff); });
  }, []);

  const load = useCallback(async (refresh = false) => {
    setLoadError(null);
    setFields({});
    if (!refresh) setResult(null);
    const res = await http<Result>(`/slots/search?${queryKey}`);
    if (res.ok) setResult(res.data);
    else if (res.fields) { setFields(res.fields); setResult({ slots: [], truncated: false }); }
    else setLoadError(res.message);
  }, [queryKey]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setForm(query); }, [queryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- follow the URL

  function submit(event: FormEvent) {
    event.preventDefault();
    setParams(Object.fromEntries(Object.entries(form).filter(([, v]) => v)));
    if (new URLSearchParams(Object.entries(form).filter(([, v]) => v)).toString() === queryKey) load();
  }

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setBookError(null);
    const res = await http<{ booking: { reference: string } }>('/bookings', { method: 'POST', body: { slotId: selected.id, note } });
    setBusy(false);
    if (res.ok) setBooked(res.data.booking.reference);
    else setBookError(res.fields ? Object.values(res.fields).join(' ') : res.message);
    if (res.ok || res.status === 404 || res.status === 409) load(true);
  }
  const close = () => { if (!busy) { setSelected(null); setBooked(null); } };

  const field = (name: keyof typeof form) => ({
    id: name, value: form[name], 'aria-invalid': !!fields[name],
    'aria-describedby': fields[name] ? `${name}-error` : undefined,
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [name]: e.target.value }),
  });
  const fieldError = (name: string) => fields[name] && <p id={`${name}-error`} className="field-error">{fields[name]}</p>;

  const days = new Map<string, SlotView[]>();
  for (const slot of result?.slots ?? []) days.set(bangkokDate(slot.startAt), [...(days.get(bangkokDate(slot.startAt)) ?? []), slot]);

  return (
    <>
      <h1>Find a Slot</h1>
      <form role="search" aria-label="Search slots" className="filters" onSubmit={submit} noValidate>
        <div><label htmlFor="from">From</label><input type="date" {...field('from')} />{fieldError('from')}</div>
        <div><label htmlFor="to">To</label><input type="date" {...field('to')} />{fieldError('to')}</div>
        <div>
          <label htmlFor="serviceId">Service</label>
          <select {...field('serviceId')}>
            <option value="">All services</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {fieldError('serviceId')}
        </div>
        <div>
          <label htmlFor="staffId">Staff</label>
          <select {...field('staffId')}>
            <option value="">All staff</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {fieldError('staffId')}
        </div>
        <button type="submit">Search</button>
      </form>

      <section aria-labelledby="results-title">
        <h2 id="results-title">Available slots</h2>
        {loadError ? <Callout tone="error" onRetry={() => load()}>{loadError}</Callout>
          : result === null ? <Skeleton label="Searching slots" />
            : Object.keys(fields).length ? <p className="muted">Correct the search above.</p>
              : result.slots.length === 0 ? <EmptyState message="No available slots for this search. Try other dates or filters." />
                : (
                  <>
                    {result.truncated && <Callout>Showing the first 200 slots. Narrow your search.</Callout>}
                    {[...days].map(([day, slots]) => (
                      <section key={day} aria-label={formatDay(`${day}T12:00:00+07:00`)}>
                        <h3>{formatDay(`${day}T12:00:00+07:00`)} — {slots.length} {slots.length === 1 ? 'slot' : 'slots'}</h3>
                        <ul className="slot-list">
                          {slots.map((slot) => (
                            <li key={slot.id} className="slot-card">
                              <p className="slot-time">{formatTimeRange(slot)}</p>
                              <p>{slot.service.name}</p>
                              <p className="muted">{slot.staff.name}</p>
                              <button type="button" aria-label={`Book ${formatDay(slot.startAt)} ${formatTime(slot.startAt)} ${slot.service.name} with ${slot.staff.name}`}
                                onClick={() => { setSelected(slot); setNote(''); setBookError(null); setBooked(null); }}>Book</button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </>
                )}
      </section>

      {selected && (
        <ConfirmDialog title="Confirm booking" onCancel={close}>
          <p>{formatDay(selected.startAt)}, {formatTimeRange(selected)}<br />{selected.service.name} with {selected.staff.name}</p>
          {booked ? (
            <>
              <Callout>Booked! Reference {booked}</Callout>
              <div className="dialog-actions">
                <Link to={`/bookings/${booked}`}>View booking</Link>
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
                <button type="button" onClick={confirm} disabled={busy}>Confirm booking</button>
                <button type="button" className="secondary" onClick={close} disabled={busy}>Cancel</button>
              </div>
            </>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
