import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SchedulePage from '../src/pages/SchedulePage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const service = { id: 1, name: 'Academic advising', durationMin: 30 };
const slot = (id: number, start: string, booking: object | null) => ({
  id, startAt: start, endAt: new Date(Date.parse(start) + 30 * 60_000).toISOString(), status: 'OPEN', service, booking,
});
const booking = (reference: string, status: string, canRecordOutcome: boolean, name: string) =>
  ({ reference, status, note: null, customer: { id: 3, name }, canRecordOutcome });

afterEach(() => vi.unstubAllGlobals());

describe('SchedulePage outcomes (F-09)', () => {
  it('UI-09: Completed / No-show only where canRecordOutcome; after confirming, the badge replaces the buttons', async () => {
    let recorded = false;
    const posts: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push({ url, body: JSON.parse(String(init.body)) });
        recorded = true;
        return Promise.resolve(json(200, { booking: {}, history: [] }));
      }
      return Promise.resolve(json(200, {
        date: '2030-10-08',
        slots: [
          slot(1, '2030-10-08T02:00:00.000Z', booking('BK-2030-000051', recorded ? 'NO_SHOW' : 'BOOKED', !recorded, 'Ploy Chai')),
          slot(2, '2030-10-08T04:00:00.000Z', booking('BK-2030-000052', 'BOOKED', false, 'Ken Tan')),
        ],
        summary: { total: 2, booked: 2, open: 0, closed: 0 },
      }));
    }));
    const user = userEvent.setup();
    render(<MemoryRouter><SchedulePage /></MemoryRouter>);

    const started = (await screen.findByRole('link', { name: 'BK-2030-000051' })).closest('tr')!;
    const future = screen.getByRole('link', { name: 'BK-2030-000052' }).closest('tr')!;
    expect(within(started).getByRole('button', { name: 'No-show BK-2030-000051' })).toBeInTheDocument();
    expect(within(started).getByRole('button', { name: 'Completed BK-2030-000051' })).toBeInTheDocument();
    expect(within(future).queryAllByRole('button')).toHaveLength(0);

    await user.click(within(started).getByRole('button', { name: 'No-show BK-2030-000051' }));
    const dialog = screen.getByRole('dialog', { name: 'Record No-show?' });
    expect(dialog).toHaveTextContent('Record Ploy Chai as No-show for BK-2030-000051? This cannot be changed.');
    await user.click(within(dialog).getByRole('button', { name: 'Yes, record No-show' }));

    expect(await screen.findByText('Outcome recorded')).toBeInTheDocument();
    expect(posts).toEqual([{ url: '/api/staff/bookings/BK-2030-000051/outcome', body: { outcome: 'NO_SHOW' } }]);
    const row = screen.getByRole('link', { name: 'BK-2030-000051' }).closest('tr')!;
    expect(within(row).getByText('No-show')).toBeInTheDocument();
    expect(within(row).queryAllByRole('button')).toHaveLength(0);
  });
});
