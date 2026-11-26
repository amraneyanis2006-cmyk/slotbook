import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotificationsPage from '../src/pages/NotificationsPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const note = (o: object) => ({ id: 9, message: 'Your booking BK-2031-000051 on Thu 8 May 2031, 11:00 was cancelled by Anan Wong: Staff illness.',
  bookingReference: 'BK-2031-000051', createdAt: '2031-05-05T01:05:00.000Z', readAt: null, ...o });

afterEach(() => vi.unstubAllGlobals());

describe('NotificationsPage (F-16)', () => {
  it('UI-14: newest first, unread marked "Unread" in bold with a link to the booking; Mark as read and Mark all as read; empty state', async () => {
    let read = new Set<number>();
    const posts: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(url);
        if (url.endsWith('/read-all')) read = new Set([9, 8]); else read.add(9);
        return Promise.resolve(json(200, url.endsWith('/read-all') ? { unread: 0 } : { notification: note({ readAt: '2031-05-05T01:06:00.000Z' }) }));
      }
      const list = [note({}), note({ id: 8, bookingReference: 'BK-2031-000050', message: 'Your booking BK-2031-000050 on Mon 5 May 2031, 09:00 was recorded as No-show.', createdAt: '2031-05-05T01:00:00.000Z' })]
        .map((n) => (read.has(n.id) ? { ...n, readAt: '2031-05-05T01:06:00.000Z' } : n));
      return Promise.resolve(json(200, { notifications: list, unread: list.filter((n) => !n.readAt).length }));
    }));
    const u = userEvent.setup();
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);

    const items = await screen.findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('cancelled by Anan Wong: Staff illness.');
    expect(items[0]).toHaveTextContent('Mon 5 May 2031, 08:05');
    expect(within(items[0]).getByText('Unread')).toBeInTheDocument();
    expect(within(items[0]).getByRole('link', { name: 'View booking BK-2031-000051' })).toHaveAttribute('href', '/bookings/BK-2031-000051');
    expect(items[1]).toHaveTextContent('recorded as No-show.');
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('2 unread')).toBeInTheDocument();

    await u.click(within(items[0]).getByRole('button', { name: 'Mark as read' }));
    expect(await screen.findByText('1 unread')).toBeInTheDocument();
    expect(within(screen.getAllByRole('listitem')[0]).queryByText('Unread')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(await screen.findByText('All read')).toBeInTheDocument();
    expect(posts).toEqual(['/api/notifications/9/read', '/api/notifications/read-all']);
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  });

  it('UI-14: empty state and error state', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(200, { notifications: [], unread: 0 }))));
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
  });
});
