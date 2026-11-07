import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

// Header for every authenticated page: product name, role navigation (aria-current via NavLink), user + Log out.
const NAV = {
  CUSTOMER: [{ to: '/book', label: 'Book a Slot' }, { to: '/bookings', label: 'My Bookings' }],
  STAFF: [{ to: '/staff/slots', label: 'My Slots' }, { to: '/staff/schedule', label: 'Schedule' }],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  if (!user) return null;

  const onLogout = async () => {
    const res = await logout();
    setLogoutError(res.ok || res.status === 401 ? null : res.message);
  };

  return (
    <>
      <header className="app-header">
        <span className="brand">SlotBook</span>
        <nav aria-label="Main">
          {NAV[user.role].map((item) => <NavLink key={item.to} to={item.to}>{item.label}</NavLink>)}
        </nav>
        <div className="user">
          <span>{user.name}</span>
          <span className="badge">{user.role === 'STAFF' ? 'Staff' : 'Customer'}</span>
          <button type="button" className="secondary" onClick={onLogout}>Log out</button>
        </div>
      </header>
      <main>
        {logoutError && <p className="callout error" role="alert">{logoutError}</p>}
        <Outlet />
      </main>
    </>
  );
}
