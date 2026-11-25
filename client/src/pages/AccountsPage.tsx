import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { http } from '../api/http';
import { Callout } from '../components/Callout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';
import { formatDay, formatTime } from '../utils/time';

type Account = {
  id: number; name: string; email: string; isActive: boolean; suspendedUntil: string | null;
  activeBookings: number; activeBookingRefs: string[]; noShows30d: number;
};

// F-17 §4: customer accounts, deactivate / reactivate (Staff).
export default function AccountsPage() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await http<{ users: Account[] }>(`/staff/users${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    if (res.ok) setUsers(res.data.users);
    else setError(res.message);
  }, [query]);
  useEffect(() => { load(); }, [load]);

  async function act(user: Account, action: 'deactivate' | 'reactivate') {
    setBusy(true);
    const res = await http<{ cancelledBookings?: string[] }>(`/staff/users/${user.id}/${action}`, { method: 'POST', body: {} });
    setBusy(false);
    setConfirm(null);
    if (res.ok) {
      const n = res.data.cancelledBookings?.length ?? 0;
      setToast({ id: Date.now(), message: action === 'deactivate' ? `Account deactivated${n ? `, ${n} booking${n > 1 ? 's' : ''} cancelled` : ''}` : 'Account reactivated' });
    } else setError(res.message);
    load();
  }

  const status = (u: Account) => (!u.isActive ? 'INACTIVE' : u.suspendedUntil ? 'SUSPENDED' : 'ACTIVE');
  return (
    <>
      <h1>Accounts</h1>
      {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}
      <form role="search" className="filters" onSubmit={(e: FormEvent) => { e.preventDefault(); setQuery(q.trim()); }}>
        <div>
          <label htmlFor="q">Search by name</label>
          <input id="q" type="search" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="submit">Search</button>
      </form>
      {error && <Callout tone="error" onRetry={load}>{error}</Callout>}
      {users === null ? <Skeleton label="Loading the accounts" /> : users.length === 0 ? <EmptyState message="No customer account matches." /> : (
        <table className="responsive-table">
          <thead><tr><th>Name</th><th>E-mail</th><th>Status</th><th>Upcoming bookings</th><th>No-shows (30 days)</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td data-label="Name">{u.name}</td>
                <td data-label="E-mail">{u.email}</td>
                <td data-label="Status">
                  <StatusBadge status={status(u)} />
                  {u.isActive && u.suspendedUntil && <span className="hint"> until {formatDay(u.suspendedUntil)}, {formatTime(u.suspendedUntil)}</span>}
                </td>
                <td data-label="Upcoming bookings">{u.activeBookings}</td>
                <td data-label="No-shows (30 days)">{u.noShows30d}</td>
                <td data-label="Actions">
                  {u.isActive
                    ? <button type="button" className="secondary" aria-label={`Deactivate ${u.name}`} onClick={() => setConfirm(u)}>Deactivate</button>
                    : <button type="button" className="secondary" aria-label={`Reactivate ${u.name}`} disabled={busy} onClick={() => act(u, 'reactivate')}>Reactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {confirm && (
        <ConfirmDialog title={`Deactivate ${confirm.name}?`} onCancel={() => { if (!busy) setConfirm(null); }}>
          <p>{confirm.name} will be logged out and can no longer log in.</p>
          {confirm.activeBookingRefs.length
            ? <p>These upcoming bookings will be cancelled with the reason “account deactivated”: {confirm.activeBookingRefs.join(', ')}.</p>
            : <p>This customer has no upcoming booking.</p>}
          <div className="dialog-actions">
            <button type="button" onClick={() => act(confirm, 'deactivate')} disabled={busy}>Yes, deactivate</button>
            <button type="button" className="secondary" onClick={() => setConfirm(null)} disabled={busy}>Keep active</button>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
