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

// F-07 (Sprint 2)

const SERVICE = { id: 1, name: 'Academic advising', durationMin: 30 };
const OPEN = { id: 1, startAt: '2030-01-08T02:00:00.000Z', endAt: '2030-01-08T02:30:00.000Z', status: 'OPEN', service: SERVICE, booking: null };
const CLOSED = { id: 2, startAt: '2030-01-08T03:00:00.000Z', endAt: '2030-01-08T03:30:00.000Z', status: 'CLOSED', service: SERVICE, booking: null };
const BOOKED = {
  id: 3, startAt: '2030-01-08T04:00:00.000Z', endAt: '2030-01-08T04:30:00.000Z', status: 'OPEN', service: SERVICE,
  booking: { reference: 'BK-2030-000041', status: 'BOOKED', customer: { id: 3, name: 'Ploy Chai' } },
};



describe('MySlotsPage actions (F-07)', () => {
  it('UI-08: a booked slot offers only Cancel slot; the cancel dialog names the booking, counts characters and shows the reason error under the field', async () => {
    const cancels: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/services') return Promise.resolve(json(200, { services: [SERVICE] }));
      if (url === '/api/staff/slots/3/cancel') {
        cancels.push(JSON.parse(String(init?.body)));
        return Promise.resolve(cancels.length === 1
          ? json(422, { error: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fields: { reason: 'Enter a reason of 3 to 200 characters.' } })
          : json(200, { slot: { ...BOOKED, status: 'CANCELLED', booking: null }, cancelledBooking: 'BK-2030-000041' }));
      }
      return Promise.resolve(json(200, { slots: cancels.length === 2 ? [OPEN, CLOSED] : [OPEN, CLOSED, BOOKED] }));
    }));
    const user = userEvent.setup();
    render(<MySlotsPage />);

    const menu = async (time: string) => {
      await user.click(await screen.findByRole('button', { name: `Actions for Tue 8 Jan 2030 ${time}` }));
      return screen.getByRole('button', { name: `Actions for Tue 8 Jan 2030 ${time}` }).parentElement!;
    };
    const items = (el: HTMLElement) => within(el).getAllByRole('listitem').map((li) => li.textContent);
    expect(items(await menu('09:00'))).toEqual(['Edit time', 'Close', 'Cancel slot']);
    expect(items(await menu('10:00'))).toEqual(['Edit time', 'Reopen', 'Cancel slot']);
    const bookedMenu = await menu('11:00');
    expect(screen.getByRole('button', { name: 'Actions for Tue 8 Jan 2030 11:00' })).toHaveAttribute('aria-expanded', 'true');
    expect(items(bookedMenu)).toEqual(['Cancel slot']);

    await user.click(within(bookedMenu).getByRole('button', { name: 'Cancel slot' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel this slot?' });
    expect(dialog).toHaveTextContent('The booking BK-2030-000041 of Ploy Chai will be cancelled and the customer will see your reason.');
    await user.type(within(dialog).getByLabelText('Reason'), 'ab');
    expect(dialog).toHaveTextContent('2/200');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel slot' }));
    expect(await within(dialog).findByText('Enter a reason of 3 to 200 characters.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Reason')).toHaveAccessibleDescription('Enter a reason of 3 to 200 characters.');

    await user.clear(within(dialog).getByLabelText('Reason'));
    await user.type(within(dialog).getByLabelText('Reason'), 'Staff illness');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel slot' }));
    expect(await screen.findByText('Slot cancelled')).toBeInTheDocument();
    expect(cancels).toEqual([{ reason: 'ab' }, { reason: 'Staff illness' }]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('BK-2030-000041 · Ploy Chai')).toBeNull();
  });
});
