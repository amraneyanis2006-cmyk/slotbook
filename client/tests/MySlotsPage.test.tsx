import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MySlotsPage from '../src/pages/MySlotsPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const SLOT = {
  id: 12, startAt: '2030-01-08T02:30:00.000Z', endAt: '2030-01-08T03:00:00.000Z', status: 'OPEN',
  service: { id: 1, name: 'Academic advising', durationMin: 30 }, booking: null,
};

afterEach(() => vi.unstubAllGlobals());

describe('MySlotsPage (F-03)', () => {
  it('UI-02: skeleton while loading, empty state, field error under Start time, then toast and refreshed list', async () => {
    let releaseFirstList: (r: Response) => void = () => {};
    let listCalls = 0;
    let postCalls = 0;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/services') return Promise.resolve(json(200, { services: [{ id: 1, name: 'Academic advising', durationMin: 30 }] }));
      if (url === '/api/staff/slots' && init?.method === 'POST') {
        postCalls += 1;
        return Promise.resolve(postCalls === 1
          ? json(422, { error: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fields: { startTime: 'The slot must start in the future.' } })
          : json(201, { slot: SLOT }));
      }
      listCalls += 1;
      if (listCalls === 1) return new Promise<Response>((resolve) => { releaseFirstList = resolve; });
      return Promise.resolve(json(200, { slots: [SLOT] }));
    }));
    const user = userEvent.setup();
    render(<MySlotsPage />);

    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    releaseFirstList(json(200, { slots: [] }));
    expect(await screen.findByText('You have no upcoming slots. Publish one above.')).toBeInTheDocument();

    await user.selectOptions(await screen.findByLabelText('Service'), 'Academic advising');
    await user.type(screen.getByLabelText('Date'), '2030-01-08');
    await user.selectOptions(screen.getByLabelText('Start time'), '09:30');
    expect(screen.getByText('Ends at 10:00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Publish slot' }));

    const startTime = screen.getByLabelText('Start time');
    const error = await screen.findByText('The slot must start in the future.');
    expect(startTime).toHaveAttribute('aria-invalid', 'true');
    expect(startTime.getAttribute('aria-describedby')).toBe(error.id);

    await user.click(screen.getByRole('button', { name: 'Publish slot' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Slot published');
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Academic advising')).toBeInTheDocument();
    expect(within(table).getByText('Open')).toBeInTheDocument();
    expect(screen.getByLabelText('Service')).toHaveValue('1');
    expect(screen.getByLabelText('Date')).toHaveValue('2030-01-08');
  });
});
