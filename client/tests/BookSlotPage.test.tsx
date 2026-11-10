import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BookSlotPage from '../src/pages/BookSlotPage';
import { todayBangkok } from '../src/utils/time';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const slotView = (id: number, startAt: string, endAt: string, staff: string) => ({
  id, startAt, endAt, service: { id: 1, name: 'Academic advising', durationMin: 30 }, staff: { id: id, name: staff },
});
const FIRST = slotView(12, '2030-02-06T02:30:00.000Z', '2030-02-06T03:00:00.000Z', 'Anan Wong'); // 09:30 Bangkok
const SECOND = slotView(13, '2030-02-06T07:00:00.000Z', '2030-02-06T07:30:00.000Z', 'Mali Srisuk'); // 14:00 Bangkok

afterEach(() => vi.unstubAllGlobals());

describe('BookSlotPage (F-04)', () => {
  it('UI-03: dialog with focus trap and Esc, busy confirm, reference on 201, 409 message in the dialog and list re-fetched; empty state', async () => {
    const listUrls: string[] = [];
    let releaseBooking: (r: Response) => void = () => {};
    let bookingCalls = 0;
    const bookingBodies: unknown[] = [];
    let phase = 0; // available list of 2030-02-06: both slots → after the 201 only SECOND → after the 409 none
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/services') return Promise.resolve(json(200, { services: [{ id: 1, name: 'Academic advising', durationMin: 30 }, { id: 2, name: 'Document request', durationMin: 15 }] }));
      if (url === '/api/bookings' && init?.method === 'POST') {
        bookingCalls += 1;
        bookingBodies.push(JSON.parse(String(init.body)));
        if (bookingCalls === 1) return new Promise<Response>((resolve) => { releaseBooking = (r) => { phase = 1; resolve(r); }; });
        phase = 2;
        return Promise.resolve(json(409, { error: 'SLOT_ALREADY_BOOKED', message: 'This slot has already been booked.' }));
      }
      listUrls.push(url);
      const slots = url.includes('date=2030-02-06') ? [[FIRST, SECOND], [SECOND], []][phase] : [];
      return Promise.resolve(json(200, { slots }));
    }));
    const user = userEvent.setup();
    render(<MemoryRouter><BookSlotPage /></MemoryRouter>);

    // Defaults: today (Bangkok), all services; loading skeleton first.
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByLabelText('Date')).toHaveValue(todayBangkok());
    expect(screen.getByLabelText('Service')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'All services' })).toBeInTheDocument();
    expect(await screen.findByText('No available slots on this day. Try another date.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Date'));
    await user.type(screen.getByLabelText('Date'), '2030-02-06');
    await user.selectOptions(screen.getByLabelText('Service'), 'Academic advising');
    await waitFor(() => expect(listUrls.at(-1)).toBe('/api/slots/available?date=2030-02-06&serviceId=1'));
    const firstBook = await screen.findByRole('button', { name: /^Book 09:30/ });
    expect(screen.getByText('Anan Wong')).toBeInTheDocument();
    expect(screen.getByText('09:30–10:00')).toBeInTheDocument();

    // Dialog: focus inside, Tab stays inside, Esc closes and focus returns to the Book button.
    await user.click(firstBook);
    const dialog = screen.getByRole('dialog', { name: 'Confirm booking' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(within(dialog).getByText(/Anan Wong/)).toBeInTheDocument();
    for (let i = 0; i < 5; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(firstBook).toHaveFocus();

    // Note counter, busy-disabled confirm, then 201 → reference + link to My Bookings, list refreshed.
    await user.click(firstBook);
    await user.type(screen.getByLabelText('Note (optional)'), 'Credit transfer');
    expect(screen.getByText('15/300')).toBeInTheDocument();
    expect(screen.getByLabelText('Note (optional)')).toHaveAttribute('maxLength', '300');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(screen.getByRole('button', { name: 'Confirm booking' })).toBeDisabled();
    expect(bookingBodies[0]).toEqual({ slotId: 12, note: 'Credit transfer' });
    releaseBooking(json(201, { booking: { reference: 'BK-2030-000015', status: 'BOOKED', note: 'Credit transfer', createdAt: '2030-02-05T01:00:00.000Z', cancelledAt: null, slot: FIRST } }));
    expect(await screen.findByText('Booked! Reference BK-2030-000015')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to My Bookings' })).toHaveAttribute('href', '/bookings');
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Book 09:30/ })).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Close' }));

    // 409 → server message inside the dialog and the list is re-fetched.
    const listsBefore = listUrls.length;
    await user.click(screen.getByRole('button', { name: /^Book 14:00/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    const dialog409 = screen.getByRole('dialog', { name: 'Confirm booking' });
    expect(await within(dialog409).findByRole('alert')).toHaveTextContent('This slot has already been booked.');
    await waitFor(() => expect(listUrls.length).toBe(listsBefore + 1));
    await user.click(within(dialog409).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('No available slots on this day. Try another date.')).toBeInTheDocument();

    // Another empty day shows the empty state too.
    await user.clear(screen.getByLabelText('Date'));
    await user.type(screen.getByLabelText('Date'), '2030-02-07');
    expect(await screen.findByText('No available slots on this day. Try another date.')).toBeInTheDocument();
  });

  it('UI-03: a failed load shows the error callout with Retry', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/services') return Promise.resolve(json(200, { services: [] }));
      calls += 1;
      return Promise.resolve(calls === 1
        ? json(500, { error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' })
        : json(200, { slots: [FIRST] }));
    }));
    const user = userEvent.setup();
    render(<MemoryRouter><BookSlotPage /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: /^Book 09:30/ })).toBeInTheDocument();
  });
});
