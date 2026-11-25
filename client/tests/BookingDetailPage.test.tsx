import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BookingDetailPage from '../src/pages/BookingDetailPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const BOOKING = {
  reference: 'BK-2030-000031', status: 'CANCELLED', note: null,
  createdAt: '2030-06-03T01:00:00.000Z', cancelledAt: '2030-06-04T03:00:00.000Z',
  slot: {
    id: 9, startAt: '2030-06-10T02:00:00.000Z', endAt: '2030-06-10T02:30:00.000Z',
    service: { id: 1, name: 'Academic advising', durationMin: 30 }, staff: { id: 1, name: 'Anan Wong' },
  },
};
const HISTORY = [
  { at: '2030-06-03T01:00:00.000Z', from: null, to: 'BOOKED', actor: { name: 'Ploy Chai', role: 'CUSTOMER' }, reason: null },
  { at: '2030-06-04T03:00:00.000Z', from: 'BOOKED', to: 'CANCELLED', actor: { name: 'Anan Wong', role: 'STAFF' }, reason: 'Staff illness' },
];

afterEach(() => vi.unstubAllGlobals());

describe('BookingDetailPage history (F-10)', () => {
  it('UI-06: ordered History list with actor and reason; callout "Cancelled by Anan Wong: Staff illness"', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(200, { booking: BOOKING, history: HISTORY }))));
    render(
      <MemoryRouter initialEntries={[`/bookings/${BOOKING.reference}`]}>
        <Routes><Route path="/bookings/:reference" element={<BookingDetailPage />} /></Routes>
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'History' });
    const items = within(section).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Mon 3 Jun 2030, 08:00 — Booked by Ploy Chai (Customer)');
    expect(items[1]).toHaveTextContent('Tue 4 Jun 2030, 10:00 — Cancelled by Anan Wong (Staff)');
    expect(within(items[1]).getByText('Staff illness').tagName).toBe('BLOCKQUOTE');
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled by Anan Wong: Staff illness');
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
  });
});
