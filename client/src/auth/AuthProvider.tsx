import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { http, setSessionEndedHandler, type ApiResult } from '../api/http';

export type Role = 'CUSTOMER' | 'STAFF';
export type User = { id: number; name: string; email: string; role: Role };

type Auth = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<ApiResult<{ user: User }>>;
  logout: () => Promise<ApiResult<undefined>>;
};

const AuthContext = createContext<Auth | null>(null);

export const homeFor = (role: Role) => (role === 'STAFF' ? '/staff/slots' : '/book');

/** Holds the current user from GET /api/auth/me. Navigation comfort only: the server enforces access. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setSessionEndedHandler(() => {
      setUser(null);
      navigate('/login', { replace: true, state: { notice: 'Your session has ended.' } });
    });
  }, [navigate]);

  useEffect(() => {
    http<{ user: User }>('/auth/me').then((res) => {
      if (res.ok) setUser(res.data.user);
      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await http<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } });
    if (res.ok) setUser(res.data.user);
    return res;
  };

  /** Clears the user only when the server session is gone (204, or 401 = already ended). */
  const logout = async () => {
    const res = await http<undefined>('/auth/logout', { method: 'POST' });
    if (res.ok || res.status === 401) {
      setUser(null);
      navigate('/login', { replace: true });
    }
    return res;
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
};
