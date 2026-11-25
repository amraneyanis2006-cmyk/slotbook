import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReschedulePage from '../src/pages/ReschedulePage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const DAY = new Date(Date.now() + 5 * 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 10); // ≥ 24 h ahead
const service = { id: 1, name: 'Academic advising', durationMin: 30 };
const slotAt = (id: number, time: string, staff = 'Anan Wong') => {
  const startAt = new Date(`${DAY}T${time}:00+07:00`).toISOString();
  return { id, startAt, endAt: new Date(Date.parse(startAt) + 30 * 60_000).toISOString(), service, staff: { id: 1, name: staff } };
};
const BOOKING = { reference: 'BK-2030-000061', status: 'BOOKED', note: null, createdAt: new Date().toISOString(), cancelledAt: null, slot: slotAt(5, '09:00') };

afterEach(() => vi.unstubAllGlobals());

describe('ReschedulePage (F-08)', () => {
  it('UI-10: the current slot is excluded; Move booking is disabled until a choice; a 409 shows in a callout and the list is refreshed', async () => {
    let listCalls = 0;
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      urls.push(url);
      if (url === `/api/bookings/${BOOKING.reference}`) return Promise.resolve(json(200, { booking: BOOKING, history: [] }));
      if (url.startsWith('/api/slots/available')) {
        listCalls += 1;
        return Promise.resolve(json(200, { slots: listCalls === 1 ? [BOOKING.slot, slotAt(6, '10:00', 'Mali Srisuk'), slotAt(7, '11:00')] : [BOOKING.slot, slotAt(7, '11:00')] }));
      }
      if (url.endsWith('/reschedule') && init?.method === 'POST') {
        return Promise.resolve(json(409, { error: 'SLOT_ALREADY_BOOKED', message: 'This slot has already been booked.' }));
      }
      return Promise.resolve(json(404, { error: 'NOT_FOUND', message: 'Not found.' }));
    }));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/bookings/${BOOKING.reference}/reschedule`]}>
        <Routes><Route path="/bookings/:reference/reschedule" element={<ReschedulePage />} /></Routes>
      </MemoryRouter>,
    );

    const group = await screen.findByRole('group', { name: 'Choose a new time' });
    expect(urls).toContain(`/api/slots/available?date=${DAY}&serviceId=1`);
    expect(within(group).getAllByRole('radio').map((r) => r.closest('label')!.textContent)).toEqual(['10:00–10:30 · Mali Srisuk', '11:00–11:30 · Anan Wong']);
    const moveButton = screen.getByRole('button', { name: 'Move booking' });
    expect(moveButton).toBeDisabled();

    await user.click(within(group).getByRole('radio', { name: '10:00–10:30 · Mali Srisuk' }));
    expect(moveButton).toBeEnabled();
    await user.click(moveButton);
    const dialog = screen.getByRole('dialog', { name: 'Move this booking?' });
    expect(dialog).toHaveTextContent('with Mali Srisuk?');
    await user.click(within(dialog).getByRole('button', { name: 'Yes, move booking' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This slot has already been booked.');
    expect(await screen.findByRole('radio', { name: '11:00–11:30 · Anan Wong' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '10:00–10:30 · Mali Srisuk' })).toBeNull();
    expect(listCalls).toBe(2);
    expect(screen.getByRole('button', { name: 'Move booking' })).toBeDisabled();
  });
});
