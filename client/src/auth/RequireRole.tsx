import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { homeFor, useAuth, type Role } from './AuthProvider';

/** Route guard: no user → /login, other role → own home. Comfort only; F-02 authorizes on the server. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="page-loading" aria-busy="true">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
