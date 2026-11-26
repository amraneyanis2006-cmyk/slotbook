import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TemplatesPage from '../src/pages/TemplatesPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const advising = { id: 1, name: 'Academic advising', durationMin: 30 };

afterEach(() => vi.unstubAllGlobals());

describe('TemplatesPage (F-14)', () => {
  it('UI-13: the form posts the entries; field errors per entry; Generate shows "N slots created, M skipped" with the reasons', async () => {
    const posts: unknown[] = [];
    let templates: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/services') return Promise.resolve(json(200, { services: [advising] }));
      if (url === '/api/staff/templates' && init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)));
        if (posts.length === 1) return Promise.resolve(json(422, { error: 'VALIDATION_ERROR', message: 'x', fields: { 'entries.1.serviceId': 'Choose an active service.' } }));
        templates = [{ id: 7, name: 'Term weeks', entries: [{ weekday: 1, startTime: '09:00', service: advising }, { weekday: 3, startTime: '14:00', service: advising }] }];
        return Promise.resolve(json(201, { template: templates[0] }));
      }
      if (url === '/api/staff/templates/7/generate') {
        return Promise.resolve(json(200, { created: [{ id: 1, startAt: '2031-04-07T02:00:00.000Z', endAt: '2031-04-07T02:30:00.000Z', service: advising }],
          skipped: [{ date: '2031-04-09', startTime: '14:00', service: { id: 1, name: 'Academic advising' }, reason: 'You already have a slot at this time.' }] }));
      }
      return Promise.resolve(json(200, { templates }));
    }));
    const u = userEvent.setup();
    render(<MemoryRouter><TemplatesPage /></MemoryRouter>);

    await u.click(await screen.findByRole('button', { name: 'New template' }));
    await u.type(screen.getByLabelText('Name'), 'Term weeks');
    await u.selectOptions(screen.getAllByLabelText('Service')[0], 'Academic advising (30 min)');
    await u.click(screen.getByRole('button', { name: 'Add entry' }));
    await u.selectOptions(screen.getAllByLabelText('Weekday')[1], 'Wednesday');
    await u.selectOptions(screen.getAllByLabelText('Start time')[1], '14:00');
    await u.click(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByText('Choose an active service.')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Service')[1]).toHaveAccessibleDescription('Choose an active service.');
    expect(posts[0]).toEqual({ name: 'Term weeks', entries: [{ weekday: 1, startTime: '09:00', serviceId: 1 }, { weekday: 3, startTime: '14:00', serviceId: 0 }] });

    await u.selectOptions(screen.getAllByLabelText('Service')[1], 'Academic advising (30 min)');
    await u.click(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByText('Monday 09:00 — Academic advising')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Generate slots from Term weeks' }));
    const dialog = screen.getByRole('dialog', { name: 'Generate slots from Term weeks' });
    await u.click(within(dialog).getByRole('button', { name: 'Generate slots' }));
    expect(await within(dialog).findByText('1 slot created, 1 skipped')).toBeInTheDocument();
    expect(within(dialog).getByText('You already have a slot at this time.')).toBeInTheDocument();
  });
});
