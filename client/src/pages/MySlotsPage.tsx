import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { ConfirmDialog } from '../components/ConfirmDialog';
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

type Editing = { kind: 'edit'; slot: Slot; date: string; startTime: string } | { kind: 'cancel'; slot: Slot; reason: string };
const bangkokDate = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
const bangkokTime = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(11, 16);
const durationMin = (slot: Slot) => (new Date(slot.endAt).getTime() - new Date(slot.startAt).getTime()) / 60_000;

/** F-07 §4: per-slot Actions menu (a booked slot only offers Cancel slot). Esc closes the menu. */
function SlotActions({ slot, onEdit, onToggle, onCancel }: {
  slot: Slot; onEdit: () => void; onToggle: (open: boolean) => void; onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const label = `${formatDay(slot.startAt)} ${formatTime(slot.startAt)}`;
  // A dialog action keeps the menu open, so the dialog can return focus to the button that opened it.
  const pick = (fn: () => void, keepOpen = false) => () => { if (!keepOpen) setOpen(false); fn(); };
  return (
    <div className="actions-menu" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <button type="button" className="secondary" aria-haspopup="true" aria-expanded={open}
        aria-label={`Actions for ${label}`} onClick={() => setOpen(!open)}>Actions</button>
      {open && (
        <ul className="actions-list">
          {!slot.booking && <li><button type="button" className="secondary" onClick={pick(onEdit, true)}>Edit time</button></li>}
          {!slot.booking && slot.status === 'OPEN' && <li><button type="button" className="secondary" onClick={pick(() => onToggle(false))}>Close</button></li>}
          {!slot.booking && slot.status === 'CLOSED' && <li><button type="button" className="secondary" onClick={pick(() => onToggle(true))}>Reopen</button></li>}
          <li><button type="button" className="secondary" onClick={pick(onCancel, true)}>Cancel slot</button></li>
        </ul>
      )}
    </div>
  );
}

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
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dialogFields, setDialogFields] = useState<Record<string, string>>({});
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const openDialog = (next: Editing) => { setDialogFields({}); setDialogError(null); setEditing(next); };
  const closeDialog = () => { if (!busy) setEditing(null); };

  async function toggle(slot: Slot, open: boolean) {
    setListError(null);
    const res = await http<{ slot: Slot }>(`/staff/slots/${slot.id}/${open ? 'reopen' : 'close'}`, { method: 'POST', body: {} });
    if (res.ok) setToast({ id: Date.now(), message: open ? 'Slot reopened' : 'Slot closed' });
    else setListError(res.message);
    loadSlots();
  }

  async function submitDialog(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setDialogFields({});
    setDialogError(null);
    const res = editing.kind === 'edit'
      ? await http<{ slot: Slot }>(`/staff/slots/${editing.slot.id}`, { method: 'PATCH', body: { date: editing.date, startTime: editing.startTime } })
      : await http<{ slot: Slot }>(`/staff/slots/${editing.slot.id}/cancel`, { method: 'POST', body: { reason: editing.reason } });
    setBusy(false);
    if (res.ok) {
      setToast({ id: Date.now(), message: editing.kind === 'edit' ? 'Slot updated' : 'Slot cancelled' });
      setEditing(null);
      loadSlots();
    } else if (res.fields) {
      setDialogFields(res.fields);
    } else {
      setDialogError(res.message);
      if (res.status === 409) loadSlots();
    }
  }
  const dialogField = (name: string) => ({
    id: `dialog-${name}`, required: true, 'aria-invalid': !!dialogFields[name],
    'aria-describedby': dialogFields[name] ? `dialog-${name}-error` : undefined,
  });
  const dialogFieldError = (name: string) =>
    dialogFields[name] && <p id={`dialog-${name}-error`} className="field-error">{dialogFields[name]}</p>;

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
        {listError && <Callout tone="error">{listError}</Callout>}
        {loadError ? <Callout tone="error" onRetry={loadSlots}>{loadError}</Callout>
          : slots === null ? <Skeleton label="Loading your slots" />
            : slots.length === 0 ? <EmptyState message="You have no upcoming slots. Publish one above." />
              : (
                <table className="responsive-table">
                  <thead><tr><th>Date</th><th>Time</th><th>Service</th><th>Status</th><th>Booking</th><th>Actions</th></tr></thead>
                  <tbody>
                    {slots.map((slot) => (
                      <tr key={slot.id}>
                        <td data-label="Date">{formatDay(slot.startAt)}</td>
                        <td data-label="Time">{formatTime(slot.startAt)}–{formatTime(slot.endAt)}</td>
                        <td data-label="Service">{slot.service.name}</td>
                        <td data-label="Status"><StatusBadge status={slot.booking ? 'BOOKED' : slot.status} /></td>
                        <td data-label="Booking">{slot.booking ? `${slot.booking.reference} · ${slot.booking.customer.name}` : '—'}</td>
                        <td data-label="Actions">
                          <SlotActions slot={slot}
                            onEdit={() => openDialog({ kind: 'edit', slot, date: bangkokDate(slot.startAt), startTime: bangkokTime(slot.startAt) })}
                            onToggle={(open) => toggle(slot, open)}
                            onCancel={() => openDialog({ kind: 'cancel', slot, reason: '' })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
      </section>

      {editing?.kind === 'edit' && (
        <ConfirmDialog title="Edit slot time" onCancel={closeDialog}>
          <form onSubmit={submitDialog} noValidate>
            {dialogError && <Callout tone="error">{dialogError}</Callout>}
            <p>{editing.slot.service.name}, {durationMin(editing.slot)} min</p>
            <label htmlFor="dialog-date" className="required">Date</label>
            <input type="date" min={todayBangkok()} {...dialogField('date')} value={editing.date}
              onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            {dialogFieldError('date')}
            <label htmlFor="dialog-startTime" className="required">Start time</label>
            <select {...dialogField('startTime')} value={editing.startTime} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })}>
              {START_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {dialogFieldError('startTime')}
            <p className="hint">Ends at {addMinutes(editing.startTime, durationMin(editing.slot))}</p>
            <div className="dialog-actions">
              <button type="submit" disabled={busy}>Save time</button>
              <button type="button" className="secondary" onClick={closeDialog} disabled={busy}>Keep as is</button>
            </div>
          </form>
        </ConfirmDialog>
      )}
      {editing?.kind === 'cancel' && (
        <ConfirmDialog title="Cancel this slot?" onCancel={closeDialog}>
          <form onSubmit={submitDialog} noValidate>
            {dialogError && <Callout tone="error">{dialogError}</Callout>}
            <p>{formatDay(editing.slot.startAt)}, {formatTime(editing.slot.startAt)}–{formatTime(editing.slot.endAt)}, {editing.slot.service.name}</p>
            {editing.slot.booking && (
              <p>The booking {editing.slot.booking.reference} of {editing.slot.booking.customer.name} will be cancelled and the customer will see your reason.</p>
            )}
            <label htmlFor="dialog-reason" className="required">Reason</label>
            <textarea {...dialogField('reason')} maxLength={200} rows={3} value={editing.reason}
              onChange={(e) => setEditing({ ...editing, reason: e.target.value })} />
            <p className="hint" aria-live="polite">{editing.reason.length}/200</p>
            {dialogFieldError('reason')}
            <div className="dialog-actions">
              <button type="submit" disabled={busy}>Cancel slot</button>
              <button type="button" className="secondary" onClick={closeDialog} disabled={busy}>Keep slot</button>
            </div>
          </form>
        </ConfirmDialog>
      )}
    </>
  );
}
