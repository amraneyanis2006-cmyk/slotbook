import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { Toast } from '../components/Toast';
import { addDays, formatDay, formatTimeRange, todayBangkok } from '../utils/time';

type Service = { id: number; name: string; durationMin: number };
type Entry = { weekday: number; startTime: string; service: Service };
type Template = { id: number; name: string; entries: Entry[] };
type Draft = { id?: number; name: string; entries: { weekday: string; startTime: string; serviceId: string }[] };
type Run = { created: { id: number; startAt: string; endAt: string; service: Service }[]; skipped: { date: string; startTime: string; service: { name: string }; reason: string }[] };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMES = Array.from({ length: 40 }, (_, i) => `${String(8 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);
const blank = (): Draft['entries'][number] => ({ weekday: '1', startTime: '09:00', serviceId: '' });

// F-14 §4: own weekly templates; generate slots for up to 31 days (BR-18 skipped report).
export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [del, setDel] = useState<Template | null>(null);
  const [gen, setGen] = useState<{ t: Template; from: string; to: string; fields: Record<string, string>; run?: Run } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await http<{ templates: Template[] }>('/staff/templates');
    if (res.ok) setTemplates(res.data.templates); else setError(res.message);
  }, []);
  useEffect(() => { load(); http<{ services: Service[] }>('/services').then((r) => { if (r.ok) setServices(r.data.services); }); }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true); setFields({});
    const body = { name: draft.name, entries: draft.entries.map((x) => ({ weekday: Number(x.weekday), startTime: x.startTime, serviceId: Number(x.serviceId) || 0 })) };
    const res = draft.id ? await http(`/staff/templates/${draft.id}`, { method: 'PUT', body }) : await http('/staff/templates', { method: 'POST', body });
    setBusy(false);
    if (res.ok) { setDraft(null); setToast({ id: Date.now(), message: 'Template saved' }); load(); } else setFields(res.fields ?? { name: res.message });
  }
  async function remove(t: Template) {
    setBusy(true);
    const res = await http(`/staff/templates/${t.id}`, { method: 'DELETE' });
    setBusy(false); setDel(null);
    if (res.ok) setToast({ id: Date.now(), message: 'Template deleted' }); else setError(res.message);
    load();
  }
  async function run(e: FormEvent) {
    e.preventDefault();
    if (!gen) return;
    setBusy(true);
    const res = await http<Run>(`/staff/templates/${gen.t.id}/generate`, { method: 'POST', body: { from: gen.from, to: gen.to } });
    setBusy(false);
    if (res.ok) setGen({ ...gen, fields: {}, run: res.data }); else setGen({ ...gen, fields: res.fields ?? { to: res.message } });
  }
  const err = (k: string) => fields[k] && <p id={`${k}-error`} className="field-error">{fields[k]}</p>;
  const desc = (k: string) => ({ 'aria-invalid': !!fields[k], 'aria-describedby': fields[k] ? `${k}-error` : undefined });

  return (
    <>
      <h1>Templates</h1>
      {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}
      {error && <Callout tone="error" onRetry={load}>{error}</Callout>}
      {!draft && <button type="button" onClick={() => { setFields({}); setDraft({ name: '', entries: [blank()] }); }}>New template</button>}
      {draft && (
        <form className="panel" onSubmit={save} noValidate aria-label={draft.id ? 'Edit template' : 'New template'}>
          <label htmlFor="tpl-name" className="required">Name</label>
          <input id="tpl-name" maxLength={60} value={draft.name} {...desc('name')} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          {err('name')}
          <fieldset className="slot-choices">
            <legend>Entries</legend>
            {err('entries')}
            {draft.entries.map((x, i) => (
              <div key={i} className="filters">
                <div><label htmlFor={`wd-${i}`}>Weekday</label>
                  <select id={`wd-${i}`} value={x.weekday} {...desc(`entries.${i}.weekday`)} onChange={(e) => setDraft({ ...draft, entries: draft.entries.map((y, j) => (j === i ? { ...y, weekday: e.target.value } : y)) })}>
                    {DAYS.map((d, k) => <option key={d} value={k + 1}>{d}</option>)}
                  </select>{err(`entries.${i}.weekday`)}</div>
                <div><label htmlFor={`st-${i}`}>Start time</label>
                  <select id={`st-${i}`} value={x.startTime} {...desc(`entries.${i}.startTime`)} onChange={(e) => setDraft({ ...draft, entries: draft.entries.map((y, j) => (j === i ? { ...y, startTime: e.target.value } : y)) })}>
                    {TIMES.map((t) => <option key={t}>{t}</option>)}
                  </select>{err(`entries.${i}.startTime`)}</div>
                <div><label htmlFor={`sv-${i}`}>Service</label>
                  <select id={`sv-${i}`} value={x.serviceId} {...desc(`entries.${i}.serviceId`)} onChange={(e) => setDraft({ ...draft, entries: draft.entries.map((y, j) => (j === i ? { ...y, serviceId: e.target.value } : y)) })}>
                    <option value="">Choose a service</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMin} min)</option>)}
                  </select>{err(`entries.${i}.serviceId`)}</div>
                <button type="button" className="secondary" aria-label={`Remove entry ${i + 1}`} disabled={draft.entries.length === 1}
                  onClick={() => setDraft({ ...draft, entries: draft.entries.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={() => setDraft({ ...draft, entries: [...draft.entries, blank()] })}>Add entry</button>
          </fieldset>
          <div className="dialog-actions">
            <button type="submit" disabled={busy}>Save template</button>
            <button type="button" className="secondary" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      <section aria-labelledby="tpl-list"><h2 id="tpl-list">My templates</h2>
        {templates === null ? <Skeleton label="Loading the templates" /> : templates.length === 0 ? <EmptyState message="No template yet." /> : (
          <ul className="slot-list">
            {templates.map((t) => (
              <li key={t.id} className="slot-card">
                <p className="slot-time">{t.name}</p>
                <ul>{t.entries.map((e) => <li key={`${e.weekday}${e.startTime}`}>{DAYS[e.weekday - 1]} {e.startTime} — {e.service.name}</li>)}</ul>
                <div className="row-actions">
                  <button type="button" aria-label={`Generate slots from ${t.name}`} onClick={() => setGen({ t, from: todayBangkok(), to: addDays(todayBangkok(), 13), fields: {} })}>Generate</button>
                  <button type="button" className="secondary" aria-label={`Edit ${t.name}`} onClick={() => { setFields({}); setDraft({ id: t.id, name: t.name, entries: t.entries.map((e) => ({ weekday: String(e.weekday), startTime: e.startTime, serviceId: String(e.service.id) })) }); }}>Edit</button>
                  <button type="button" className="secondary" aria-label={`Delete ${t.name}`} onClick={() => setDel(t)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {del && (
        <ConfirmDialog title={`Delete ${del.name}?`} onCancel={() => setDel(null)}>
          <p>Slots already generated from this template are kept.</p>
          <div className="dialog-actions">
            <button type="button" onClick={() => remove(del)} disabled={busy}>Yes, delete</button>
            <button type="button" className="secondary" onClick={() => setDel(null)}>Keep template</button>
          </div>
        </ConfirmDialog>
      )}
      {gen && (
        <ConfirmDialog title={`Generate slots from ${gen.t.name}`} onCancel={() => { setGen(null); load(); }}>
          {gen.run ? (
            <>
              <p role="status"><strong>{gen.run.created.length} {gen.run.created.length === 1 ? 'slot' : 'slots'} created, {gen.run.skipped.length} skipped</strong></p>
              {gen.run.skipped.length > 0 && (
                <table className="responsive-table"><thead><tr><th>Date</th><th>Time</th><th>Service</th><th>Reason</th></tr></thead>
                  <tbody>{gen.run.skipped.map((s, i) => (
                    <tr key={i}><td data-label="Date">{formatDay(`${s.date}T12:00:00+07:00`)}</td><td data-label="Time">{s.startTime}</td><td data-label="Service">{s.service.name}</td><td data-label="Reason">{s.reason}</td></tr>
                  ))}</tbody></table>
              )}
              {gen.run.created.length > 0 && <p className="hint">First: {formatDay(gen.run.created[0].startAt)}, {formatTimeRange(gen.run.created[0])}. See <Link to="/staff/slots">My Slots</Link>.</p>}
              <div className="dialog-actions"><button type="button" onClick={() => { setGen(null); load(); }}>Done</button></div>
            </>
          ) : (
            <form onSubmit={run} noValidate>
              <label htmlFor="gen-from">From</label>
              <input id="gen-from" type="date" value={gen.from} aria-invalid={!!gen.fields.from} onChange={(e) => setGen({ ...gen, from: e.target.value })} />
              {gen.fields.from && <p className="field-error">{gen.fields.from}</p>}
              <label htmlFor="gen-to">To</label>
              <input id="gen-to" type="date" value={gen.to} aria-invalid={!!gen.fields.to} aria-describedby={gen.fields.to ? 'gen-to-error' : undefined} onChange={(e) => setGen({ ...gen, to: e.target.value })} />
              {gen.fields.to && <p id="gen-to-error" className="field-error">{gen.fields.to}</p>}
              <div className="dialog-actions">
                <button type="submit" disabled={busy}>Generate slots</button>
                <button type="button" className="secondary" onClick={() => setGen(null)}>Cancel</button>
              </div>
            </form>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
