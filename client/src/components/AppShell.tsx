import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { NOTIFICATIONS_CHANGED } from '../pages/NotificationsPage';

// Header for every authenticated page: product name, role navigation (aria-current via NavLink), user + Log out.
const NAV = {
  CUSTOMER: [{ to: '/book', label: 'Book a Slot' }, { to: '/search', label: 'Find a Slot' }, { to: '/bookings', label: 'My Bookings' }],
  STAFF: [{ to: '/staff/slots', label: 'My Slots' }, { to: '/staff/templates', label: 'Templates' }, { to: '/staff/schedule', label: 'Schedule' }, { to: '/staff/services', label: 'Services' }, { to: '/staff/dashboard', label: 'Dashboard' }, { to: '/staff/users', label: 'Accounts' }],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();
  const customer = user?.role === 'CUSTOMER';

  // F-16 §4: the unread count, refreshed on navigation and when the notifications page changes it.
  useEffect(() => {
    if (!customer) return undefined;
    let live = true;
    const refresh = () => http<{ unread: number }>('/notifications').then((res) => { if (live && res.ok) setUnread(res.data.unread); });
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => { live = false; window.removeEventListener(NOTIFICATIONS_CHANGED, refresh); };
  }, [customer, pathname]);

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
          {customer && (
            <NavLink to="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
              {unread ? `Notifications (${unread})` : 'Notifications'}
            </NavLink>
          )}
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
