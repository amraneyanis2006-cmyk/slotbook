import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BookingDetailPage from '../src/pages/BookingDetailPage';
import MyBookingsPage from '../src/pages/MyBookingsPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const HOUR = 3_600_000;
const view = (reference: string, startInMs: number, status = 'BOOKED', staff = 'Anan Wong') => {
  const startAt = new Date(Date.now() + startInMs);
  return {
    reference, status, note: `Note of ${reference}`, createdAt: new Date(Date.now() - 24 * HOUR).toISOString(),
    cancelledAt: status === 'CANCELLED' ? new Date(Date.now() - HOUR).toISOString() : null,
    slot: {
      id: 1, startAt: startAt.toISOString(), endAt: new Date(startAt.getTime() + HOUR / 2).toISOString(),
      service: { id: 1, name: 'Academic advising', durationMin: 30 }, staff: { id: 1, name: staff },
    },
  };
};
const LATER = view('BK-2030-000021', 72 * HOUR); // cancellable
const SOON = view('BK-2030-000022', 1.5 * HOUR, 'BOOKED', 'Mali Srisuk'); // inside the 2-hour window
const OLD = view('BK-2030-000020', -48 * HOUR, 'CANCELLED');

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/bookings" element={<MyBookingsPage />} />
      <Route path="/bookings/:reference" element={<BookingDetailPage />} />
    </Routes>
  </MemoryRouter>,
);

afterEach(() => vi.unstubAllGlobals());

describe('MyBookingsPage / BookingDetailPage (F-05)', () => {
  it('UI-04: two sections with badges; Cancel only for the cancellable booking; after confirming, the badge shows Cancelled', async () => {
    let cancelled = false;
    const cancelCalls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/bookings/mine') return Promise.resolve(json(200, { upcoming: [SOON, LATER], past: [OLD] }));
      if (url === `/api/bookings/${LATER.reference}/cancel` && init?.method === 'POST') {
        cancelCalls.push(url);
        cancelled = true;
        return Promise.resolve(json(200, { booking: { ...LATER, status: 'CANCELLED', cancelledAt: new Date().toISOString() } }));
      }
      if (url === `/api/bookings/${LATER.reference}`) return Promise.resolve(json(200, { booking: cancelled ? { ...LATER, status: 'CANCELLED' } : LATER }));
      if (url === `/api/bookings/${SOON.reference}`) return Promise.resolve(json(200, { booking: SOON }));
      return Promise.resolve(json(404, { error: 'NOT_FOUND', message: 'Booking not found.' }));
    }));
    const user = userEvent.setup();
    renderAt('/bookings');

    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    const upcoming = await screen.findByRole('region', { name: 'Upcoming' });
    const past = screen.getByRole('region', { name: 'Past and cancelled' });
    expect(within(upcoming).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent))
      .toEqual([SOON.reference, LATER.reference]);
    expect(within(upcoming).getAllByText('Booked')).toHaveLength(2);
    expect(within(past).getByText(OLD.reference)).toBeInTheDocument();
    expect(within(past).getByText('Cancelled')).toBeInTheDocument();

    // Inside the 2-hour window: no Cancel button, the reason instead.
    await user.click(within(upcoming).getByRole('link', { name: `View ${SOON.reference}` }));
    expect(await screen.findByRole('heading', { name: `Booking ${SOON.reference}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
    expect(screen.getByText('Cancellation closes 2 hours before the start.')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to My Bookings' }));

    // Cancellable: dialog (Esc closes), confirm → toast, Cancelled badge, no more Cancel button.
    await user.click(await screen.findByRole('link', { name: `View ${LATER.reference}` }));
    expect(await screen.findByText(`Note of ${LATER.reference}`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(screen.getByRole('dialog', { name: 'Cancel this booking?' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cancelCalls).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel booking' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Booking cancelled');
    expect(cancelCalls).toEqual([`/api/bookings/${LATER.reference}/cancel`]);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
    expect(screen.queryByText('Booked')).toBeNull();
  });

  it('UI-04: a refused cancel (409) closes the dialog, shows the server message on the page, focuses the heading and reloads the status', async () => {
    let loads = 0;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(json(409, { error: 'CANCELLATION_WINDOW_CLOSED', message: 'Cancellation closes 2 hours before the start.' }));
      loads += 1;
      return Promise.resolve(json(200, { booking: LATER }));
    }));
    const user = userEvent.setup();
    renderAt(`/bookings/${LATER.reference}`);

    await user.click(await screen.findByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel booking' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cancellation closes 2 hours before the start.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: `Booking ${LATER.reference}` })).toHaveFocus();
    expect(loads).toBe(2);
  });

  it('UI-04: empty list, load error with Retry, and "Booking not found." for a foreign reference', async () => {
    let mineCalls = 0;
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/bookings/mine') {
        mineCalls += 1;
        return Promise.resolve(mineCalls === 1
          ? json(500, { error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' })
          : json(200, { upcoming: [], past: [] }));
      }
      return Promise.resolve(json(404, { error: 'NOT_FOUND', message: 'Booking not found.' }));
    }));
    const user = userEvent.setup();
    const { unmount } = renderAt('/bookings');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('You have no bookings yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book a slot.' })).toHaveAttribute('href', '/book');
    unmount();

    renderAt('/bookings/BK-2030-000099');
    expect(await screen.findByRole('heading', { name: 'Booking not found.' })).toBeInTheDocument();
  });
});
