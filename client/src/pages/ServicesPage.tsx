import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';

type Service = { id: number; name: string; durationMin: number; isActive: boolean; upcomingSlots: number };
const DURATIONS = Array.from({ length: 8 }, (_, i) => (i + 1) * 15); // 15 … 120 (F-11 §2)

/** Inline Name + Duration fields shared by the add form and the row editor; server field errors under each field. */
function ServiceFields({ prefix, value, onChange, fields }: {
  prefix: string; value: { name: string; durationMin: string }; fields: Record<string, string>;
  onChange: (v: { name: string; durationMin: string }) => void;
}) {
  const props = (name: 'name' | 'durationMin') => ({
    id: `${prefix}-${name}`, required: true, 'aria-invalid': !!fields[name],
    'aria-describedby': fields[name] ? `${prefix}-${name}-error` : undefined,
  });
  const error = (name: string) => fields[name] && <p id={`${prefix}-${name}-error`} className="field-error">{fields[name]}</p>;
  return (
    <>
      <div>
        <label htmlFor={`${prefix}-name`} className="required">Name</label>
        <input {...props('name')} maxLength={80} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
        {error('name')}
      </div>
      <div>
        <label htmlFor={`${prefix}-durationMin`} className="required">Duration</label>
        <select {...props('durationMin')} value={value.durationMin} onChange={(e) => onChange({ ...value, durationMin: e.target.value })}>
          <option value="">Choose a duration</option>
          {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
        </select>
        {error('durationMin')}
      </div>
    </>
  );
}

// F-11 §4: the shared service catalogue (A-06).
export default function ServicesPage() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', durationMin: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: number; name: string; durationMin: string } | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Service | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await http<{ services: Service[] }>('/staff/services');
    if (res.ok) setServices(res.data.services);
    else setLoadError(res.message);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toBody = (v: { name: string; durationMin: string }) => ({ name: v.name, durationMin: v.durationMin ? Number(v.durationMin) : undefined });

  async function add(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFields({});
    const res = await http<{ service: Service }>('/staff/services', { method: 'POST', body: toBody(form) });
    setSaving(false);
    if (res.ok) {
      setToast({ id: Date.now(), message: 'Service added' });
      setForm({ name: '', durationMin: '' });
      load();
    } else {
      // 409 SERVICE_NAME_TAKEN belongs to the Name field (F-11 §4).
      setFields(res.error === 'SERVICE_NAME_TAKEN' ? { name: res.message } : res.fields ?? { name: res.message });
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setEditFields({});
    const res = await http<{ service: Service }>(`/staff/services/${editing.id}`, { method: 'PATCH', body: toBody(editing) });
    if (res.ok) {
      setEditing(null);
      setToast({ id: Date.now(), message: 'Service updated' });
      load();
    } else {
      setEditFields(res.error === 'SERVICE_NAME_TAKEN' ? { name: res.message } : res.fields ?? { name: res.message });
    }
  }

  async function setActive(service: Service, isActive: boolean) {
    setPageError(null);
    const res = await http<{ service: Service }>(`/staff/services/${service.id}`, { method: 'PATCH', body: { isActive } });
    setConfirm(null);
    if (res.ok) setToast({ id: Date.now(), message: isActive ? 'Service reactivated' : 'Service deactivated' });
    else setPageError(res.message);
    load();
  }

  return (
    <>
      <h1>Services</h1>
      {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}

      <section aria-labelledby="add-title" className="panel">
        <h2 id="add-title">Add a service</h2>
        <form onSubmit={add} noValidate className="slot-form">
          <ServiceFields prefix="new" value={form} onChange={setForm} fields={fields} />
          <button type="submit" disabled={saving}>Add service</button>
        </form>
      </section>

      <section aria-labelledby="list-title">
        <h2 id="list-title">All services</h2>
        {pageError && <Callout tone="error">{pageError}</Callout>}
        {loadError ? <Callout tone="error" onRetry={load}>{loadError}</Callout>
          : services === null ? <Skeleton label="Loading the services" />
            : (
              <table className="responsive-table">
                <thead><tr><th>Name</th><th>Duration</th><th>Status</th><th>Upcoming slots</th><th>Actions</th></tr></thead>
                <tbody>
                  {services.map((s) => editing?.id === s.id ? (
                    <tr key={s.id}>
                      <td colSpan={5}>
                        <form onSubmit={save} noValidate className="slot-form" aria-label={`Edit ${s.name}`}>
                          <ServiceFields prefix={`edit-${s.id}`} value={editing} onChange={(v) => setEditing({ ...editing, ...v })} fields={editFields} />
                          <div className="dialog-actions">
                            <button type="submit">Save</button>
                            <button type="button" className="secondary" onClick={() => { setEditing(null); setEditFields({}); }}>Cancel</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id}>
                      <td data-label="Name">{s.name}</td>
                      <td data-label="Duration">{s.durationMin} min</td>
                      <td data-label="Status"><StatusBadge status={s.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                      <td data-label="Upcoming slots">{s.upcomingSlots}</td>
                      <td data-label="Actions" className="row-actions">
                        <button type="button" className="secondary" aria-label={`Edit ${s.name}`}
                          onClick={() => { setEditFields({}); setEditing({ id: s.id, name: s.name, durationMin: String(s.durationMin) }); }}>Edit</button>
                        {s.isActive
                          ? <button type="button" className="secondary" aria-label={`Deactivate ${s.name}`} onClick={() => setConfirm(s)}>Deactivate</button>
                          : <button type="button" className="secondary" aria-label={`Reactivate ${s.name}`} onClick={() => setActive(s, true)}>Reactivate</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
      </section>

      {confirm && (
        <ConfirmDialog title={`Deactivate ${confirm.name}?`} onCancel={() => setConfirm(null)}>
          <p>Customers will no longer be able to book its open slots. Existing bookings stay.</p>
          <div className="dialog-actions">
            <button type="button" onClick={() => setActive(confirm, false)}>Yes, deactivate</button>
            <button type="button" className="secondary" onClick={() => setConfirm(null)}>Keep active</button>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
