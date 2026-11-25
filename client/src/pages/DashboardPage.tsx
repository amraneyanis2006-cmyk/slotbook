import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { addDays, formatDay, todayBangkok } from '../utils/time';

type Dashboard = {
  from: string; to: string;
  slots: { total: number; booked: number; open: number; closed: number };
  outcomes: { completed: number; noShow: number; pending: number };
  noShowRate: number | null;
  perService: { serviceId: number; name: string; bookings: number }[];
};
const day = (date: string) => formatDay(`${date}T12:00:00+07:00`);

// F-15 §4: own figures for a period (default: the last 30 days), as text tiles and a table.
export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const from = params.get('from') ?? addDays(todayBangkok(), -29);
  const to = params.get('to') ?? todayBangkok();
  const [form, setForm] = useState({ from, to });
  const [data, setData] = useState<Dashboard | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setFields({});
    setData(null);
    const res = await http<Dashboard>(`/staff/dashboard?${new URLSearchParams({ from, to })}`);
    if (res.ok) setData(res.data);
    else if (res.fields) setFields(res.fields);
    else setError(res.message);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setForm({ from, to }); }, [from, to]);

  const show = (event: FormEvent) => { event.preventDefault(); setParams(form); };
  const input = (name: 'from' | 'to') => ({
    id: name, type: 'date', value: form[name], 'aria-invalid': !!fields[name],
    'aria-describedby': fields[name] ? `${name}-error` : undefined,
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [name]: e.target.value }),
  });
  const totalBookings = data?.perService.reduce((n, s) => n + s.bookings, 0) ?? 0;

  return (
    <>
      <h1>Dashboard</h1>
      <form className="filters" onSubmit={show} noValidate aria-label="Period">
        <div><label htmlFor="from">From</label><input {...input('from')} />{fields.from && <p id="from-error" className="field-error">{fields.from}</p>}</div>
        <div><label htmlFor="to">To</label><input {...input('to')} />{fields.to && <p id="to-error" className="field-error">{fields.to}</p>}</div>
        <button type="submit">Show</button>
      </form>

      <section aria-labelledby="period-title">
        <h2 id="period-title">{day(from)} – {day(to)}</h2>
        {error ? <Callout tone="error" onRetry={load}>{error}</Callout>
          : Object.keys(fields).length ? <p className="muted">Correct the period above.</p>
            : data === null ? <Skeleton label="Loading the dashboard" />
              : data.slots.total === 0 ? <EmptyState message="No slots in this period."><Link to="/staff/slots">My Slots</Link></EmptyState>
                : (
                  <>
                    <dl className="tiles">
                      <div className="tile"><dt>Slots</dt><dd>{data.slots.total}</dd></div>
                      <div className="tile"><dt>Booked</dt><dd>{data.slots.booked}</dd></div>
                      <div className="tile"><dt>Open</dt><dd>{data.slots.open}</dd></div>
                      <div className="tile">
                        <dt>No-show rate</dt>
                        <dd>{data.noShowRate === null ? '—' : `${(data.noShowRate * 100).toFixed(1)} %`}</dd>
                        {data.noShowRate === null && <p className="hint">No outcome recorded in this period.</p>}
                      </div>
                    </dl>
                    <p className="summary">
                      {data.outcomes.completed} completed · {data.outcomes.noShow} no-show · {data.outcomes.pending} not recorded yet
                      {data.slots.closed > 0 && ` · ${data.slots.closed} closed`}
                    </p>
                    <h3>Bookings per service</h3>
                    {data.perService.length === 0 ? <p className="muted">No bookings in this period.</p> : (
                      <table className="responsive-table">
                        <thead><tr><th>Service</th><th>Bookings</th><th>Share</th></tr></thead>
                        <tbody>
                          {data.perService.map((s) => (
                            <tr key={s.serviceId}>
                              <td data-label="Service">{s.name}</td>
                              <td data-label="Bookings">{s.bookings}</td>
                              <td data-label="Share">{Math.round((s.bookings / totalBookings) * 100)} %</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
      </section>
    </>
  );
}
