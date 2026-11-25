import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SearchPage from '../src/pages/SearchPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const service = { id: 1, name: 'Academic advising', durationMin: 30 };
const slot = (id: number, startAt: string) => ({
  id, startAt, endAt: new Date(Date.parse(startAt) + 30 * 60_000).toISOString(), service, staff: { id: 2, name: 'Mali Srisuk' },
});

afterEach(() => vi.unstubAllGlobals());

describe('SearchPage (F-12)', () => {
  it('UI-11: the form is filled from the URL, results are grouped by day, a 422 shows the field error', async () => {
    const searches: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/services') return Promise.resolve(json(200, { services: [service] }));
      if (url === '/api/staff-members') return Promise.resolve(json(200, { staff: [{ id: 1, name: 'Anan Wong' }, { id: 2, name: 'Mali Srisuk' }] }));
      searches.push(url);
      return Promise.resolve(url.includes('to=2030-12-01')
        ? json(422, { error: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fields: { to: 'The end date must be on or after the start date.' } })
        : json(200, { slots: [slot(1, '2030-12-03T02:00:00.000Z'), slot(2, '2030-12-03T03:00:00.000Z'), slot(3, '2030-12-04T02:00:00.000Z')], truncated: false }));
    }));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/search?from=2030-12-02&to=2030-12-08&serviceId=1&staffId=2']}>
        <Routes><Route path="/search" element={<SearchPage />} /></Routes>
      </MemoryRouter>,
    );

    const day1 = await screen.findByRole('region', { name: 'Tue 3 Dec 2030' });
    expect(searches[0]).toBe('/api/slots/search?from=2030-12-02&to=2030-12-08&serviceId=1&staffId=2');
    expect(screen.getByLabelText('From')).toHaveValue('2030-12-02');
    expect(screen.getByLabelText('To')).toHaveValue('2030-12-08');
    expect(await screen.findByRole('option', { name: 'Mali Srisuk' })).toBeInTheDocument();
    expect(screen.getByLabelText('Staff')).toHaveValue('2');
    expect(within(day1).getByRole('heading')).toHaveTextContent('Tue 3 Dec 2030 — 2 slots');
    expect(within(day1).getAllByRole('listitem')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: 'Wed 4 Dec 2030' })).getByRole('heading')).toHaveTextContent('1 slot');

    await user.clear(screen.getByLabelText('To'));
    await user.type(screen.getByLabelText('To'), '2030-12-01');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('The end date must be on or after the start date.')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toHaveAccessibleDescription('The end date must be on or after the start date.');
    expect(searches.at(-1)).toBe('/api/slots/search?from=2030-12-02&to=2030-12-01&serviceId=1&staffId=2');
  });
});
