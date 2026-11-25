import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '../src/pages/DashboardPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const FULL = {
  from: '2031-01-06', to: '2031-01-19', slots: { total: 7, booked: 5, open: 1, closed: 1 },
  outcomes: { completed: 2, noShow: 1, pending: 1 }, noShowRate: 0.333,
  perService: [{ serviceId: 1, name: 'Academic advising', bookings: 3 }, { serviceId: 2, name: 'Document request', bookings: 2 }],
};
function Url() { return <p data-testid="url">{useLocation().search}</p>; }

afterEach(() => vi.unstubAllGlobals());

describe('DashboardPage (F-15)', () => {
  it('UI-12: four labelled tiles, the outcomes line and the per-service table; a null rate shows "—" and the sentence; Show updates the URL', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      urls.push(url);
      return Promise.resolve(json(200, url.includes('from=2031-01-01')
        ? { ...FULL, from: '2031-01-01', to: '2031-01-02', outcomes: { completed: 0, noShow: 0, pending: 1 }, noShowRate: null }
        : FULL));
    }));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/staff/dashboard?from=2031-01-06&to=2031-01-19']}>
        <Routes><Route path="/staff/dashboard" element={<><DashboardPage /><Url /></>} /></Routes>
      </MemoryRouter>,
    );

    const tile = async (label: string) => (await screen.findByText(label, { selector: 'dt' })).parentElement!;
    expect(within(await tile('Slots')).getByText('7')).toBeInTheDocument();
    expect(within(await tile('Booked')).getByText('5')).toBeInTheDocument();
    expect(within(await tile('Open')).getByText('1')).toBeInTheDocument();
    expect(within(await tile('No-show rate')).getByText('33.3 %')).toBeInTheDocument();
    expect(screen.getByText(/2 completed · 1 no-show · 1 not recorded yet/)).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(rows).toEqual([['Academic advising', '3', '60 %'], ['Document request', '2', '40 %']]);
    expect(urls[0]).toBe('/api/staff/dashboard?from=2031-01-06&to=2031-01-19');

    await user.clear(screen.getByLabelText('From'));
    await user.type(screen.getByLabelText('From'), '2031-01-01');
    await user.clear(screen.getByLabelText('To'));
    await user.type(screen.getByLabelText('To'), '2031-01-02');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(await screen.findByText('No outcome recorded in this period.')).toBeInTheDocument();
    expect(within(await tile('No-show rate')).getByText('—')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('?from=2031-01-01&to=2031-01-02');
  });
});
