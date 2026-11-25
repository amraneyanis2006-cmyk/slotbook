import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountsPage from '../src/pages/AccountsPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const user = (o: object) => ({ id: 3, name: 'Ploy Chai', email: 'cust.ploy@slotbook.test', isActive: true, suspendedUntil: null,
  activeBookings: 2, activeBookingRefs: ['BK-2031-000071', 'BK-2031-000072'], noShows30d: 0, ...o });

afterEach(() => vi.unstubAllGlobals());

describe('AccountsPage (F-17)', () => {
  it('UI-15: status badges (Active / Suspended until … / Inactive); the deactivate dialog names the bookings; the row becomes Inactive', async () => {
    let deactivated = false;
    const posts: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { posts.push(url); deactivated = true; return Promise.resolve(json(200, { user: {}, cancelledBookings: ['BK-2031-000071', 'BK-2031-000072'] })); }
      return Promise.resolve(json(200, { users: [
        user(deactivated ? { isActive: false, activeBookings: 0, activeBookingRefs: [] } : {}),
        user({ id: 4, name: 'Ken Tan', email: 'cust.ken@slotbook.test', suspendedUntil: '2031-02-22T03:00:00.000Z', noShows30d: 3, activeBookings: 0, activeBookingRefs: [] }),
      ] }));
    }));
    const u = userEvent.setup();
    render(<AccountsPage />);

    const ploy = (await screen.findByText('Ploy Chai')).closest('tr')!;
    const ken = screen.getByText('Ken Tan').closest('tr')!;
    expect(within(ploy).getByText('Active')).toBeInTheDocument();
    expect(within(ken).getByText('Suspended')).toBeInTheDocument();
    expect(ken).toHaveTextContent('until Sat 22 Feb 2031, 10:00');

    await u.click(within(ploy).getByRole('button', { name: 'Deactivate Ploy Chai' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate Ploy Chai?' });
    expect(dialog).toHaveTextContent('These upcoming bookings will be cancelled with the reason “account deactivated”: BK-2031-000071, BK-2031-000072.');
    await u.click(within(dialog).getByRole('button', { name: 'Yes, deactivate' }));
    expect(await screen.findByText('Account deactivated, 2 bookings cancelled')).toBeInTheDocument();
    expect(posts).toEqual(['/api/staff/users/3/deactivate']);
    expect(within(screen.getByText('Ploy Chai').closest('tr')!).getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivate Ploy Chai' })).toBeInTheDocument();
  });
});
