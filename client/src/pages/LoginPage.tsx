import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from '../auth/AuthProvider';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; fields?: Record<string, string> } | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <main className="page-loading" aria-busy="true">Loading…</main>;
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await login(email, password);
    setBusy(false);
    if (!res.ok) {
      setError({ message: res.message, fields: res.fields });
      setPassword('');
    }
  }

  return (
    <main className="login">
      <h1>SlotBook</h1>
      <p className="muted">Log in to book or manage appointment slots.</p>
      {notice && !error && <p className="callout" role="status">{notice}</p>}
      {error && <p className="callout error" role="alert">{error.message}</p>}
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error?.fields?.email} aria-describedby={error?.fields?.email ? 'email-error' : undefined} />
        {error?.fields?.email && <p id="email-error" className="field-error">{error.fields.email}</p>}

        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error?.fields?.password} aria-describedby={error?.fields?.password ? 'password-error' : undefined} />
        {error?.fields?.password && <p id="password-error" className="field-error">{error.fields.password}</p>}

        <button type="submit" disabled={busy}>Log in</button>
      </form>
    </main>
  );
}
