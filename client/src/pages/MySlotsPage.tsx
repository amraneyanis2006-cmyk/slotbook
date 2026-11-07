import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';
import { addMinutes, formatDay, formatTime, todayBangkok } from '../utils/time';

type Service = { id: number; name: string; durationMin: number };
type Slot = {
  id: number; startAt: string; endAt: string; status: string; service: Service;
  booking: null | { reference: string; status: string; customer: { id: number; name: string } };
};

// 08:00 … 17:45 in 15-minute steps (F-03 §4).
const START_TIMES = Array.from({ length: 40 }, (_, i) => addMinutes('08:00', i * 15));

export default function MySlotsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ serviceId: '', date: '', startTime: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const loadSlots = useCallback(async () => {
    setLoadError(null);
    const res = await http<{ slots: Slot[] }>('/staff/slots');
    if (res.ok) setSlots(res.data.slots);
    else setLoadError(res.message);
  }, []);

  const loadServices = useCallback(async () => {
    setServicesError(null);
    const res = await http<{ services: Service[] }>('/services');
    if (res.ok) setServices(res.data.services);
    else setServicesError(res.message);
  }, []);

  useEffect(() => {
    loadServices();
    loadSlots();
  }, [loadServices, loadSlots]);

  const service = services.find((s) => String(s.id) === form.serviceId);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFields({});
    setFormError(null);
    const res = await http<{ slot: Slot }>('/staff/slots', {
      method: 'POST',
      body: { serviceId: form.serviceId ? Number(form.serviceId) : undefined, date: form.date, startTime: form.startTime },
    });
    setSaving(false);
    if (res.ok) {
      setToast({ id: Date.now(), message: 'Slot published' });
      setForm({ ...form, startTime: '' });
      loadSlots();
    } else {
      setFields(res.fields ?? {});
      setFormError(res.message);
    }
  }

  const fieldProps = (name: keyof typeof form) => ({
    id: name,
    value: form[name],
    required: true,
    'aria-invalid': !!fields[name],
    'aria-describedby': fields[name] ? `${name}-error` : undefined,
  });
  const fieldError = (name: string) => fields[name] && <p id={`${name}-error`} className="field-error">{fields[name]}</p>;

  return (
    <>
      <h1>My Slots</h1>
      {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}

      <section aria-labelledby="publish-title" className="panel">
        <h2 id="publish-title">Publish a slot</h2>
        {servicesError && <Callout tone="error" onRetry={loadServices}>{servicesError}</Callout>}
        {formError && <Callout tone="error">{formError}</Callout>}
        <form onSubmit={onSubmit} noValidate className="slot-form">
          <div>
            <label htmlFor="serviceId" className="required">Service</label>
            <select {...fieldProps('serviceId')} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
              <option value="">Choose a service</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {fieldError('serviceId')}
          </div>
          <div>
            <label htmlFor="date" className="required">Date</label>
            <input type="date" min={todayBangkok()} {...fieldProps('date')} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            {fieldError('date')}
          </div>
          <div>
            <label htmlFor="startTime" className="required">Start time</label>
            <select {...fieldProps('startTime')} onChange={(e) => setForm({ ...form, startTime: e.target.value })}>
              <option value="">Choose a time</option>
              {START_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {fieldError('startTime')}
            {service && form.startTime && <p className="hint">Ends at {addMinutes(form.startTime, service.durationMin)}</p>}
          </div>
          <button type="submit" disabled={saving}>Publish slot</button>
        </form>
      </section>

      <section aria-labelledby="upcoming-title">
        <h2 id="upcoming-title">Upcoming slots</h2>
        {loadError ? <Callout tone="error" onRetry={loadSlots}>{loadError}</Callout>
          : slots === null ? <Skeleton label="Loading your slots" />
            : slots.length === 0 ? <EmptyState message="You have no upcoming slots. Publish one above." />
              : (
                <table className="responsive-table">
                  <thead><tr><th>Date</th><th>Time</th><th>Service</th><th>Status</th><th>Booking</th></tr></thead>
                  <tbody>
                    {slots.map((slot) => (
                      <tr key={slot.id}>
                        <td data-label="Date">{formatDay(slot.startAt)}</td>
                        <td data-label="Time">{formatTime(slot.startAt)}–{formatTime(slot.endAt)}</td>
                        <td data-label="Service">{slot.service.name}</td>
                        <td data-label="Status"><StatusBadge status={slot.booking ? 'BOOKED' : slot.status} /></td>
                        <td data-label="Booking">{slot.booking ? `${slot.booking.reference} · ${slot.booking.customer.name}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
      </section>
    </>
  );
}
