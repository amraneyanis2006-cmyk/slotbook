import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ServicesPage from '../src/pages/ServicesPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('ServicesPage (F-11)', () => {
  it('UI-07: field errors under the fields, 409 under Name; deactivating through the dialog shows the Inactive badge', async () => {
    let active = true;
    const posts: unknown[] = [];
    const patches: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/staff/services' && init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)));
        return Promise.resolve(posts.length === 1
          ? json(422, { error: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fields: { name: 'Enter a name of 3 to 60 characters.', durationMin: 'Choose a duration from 15 to 120 minutes in 15-minute steps.' } })
          : json(409, { error: 'SERVICE_NAME_TAKEN', message: 'A service with this name already exists.' }));
      }
      if (url === '/api/staff/services/1' && init?.method === 'PATCH') {
        patches.push(JSON.parse(String(init.body)));
        active = false;
        return Promise.resolve(json(200, { service: { id: 1, name: 'Academic advising', durationMin: 30, isActive: false, upcomingSlots: 4 } }));
      }
      return Promise.resolve(json(200, { services: [{ id: 1, name: 'Academic advising', durationMin: 30, isActive: active, upcomingSlots: 4 }] }));
    }));
    const user = userEvent.setup();
    render(<MemoryRouter><ServicesPage /></MemoryRouter>);

    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    const row = (await screen.findByText('Academic advising')).closest('tr')!;
    expect(within(row).getByText('Active')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'ab');
    await user.click(screen.getByRole('button', { name: 'Add service' }));
    expect(await screen.findByText('Enter a name of 3 to 60 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter a name of 3 to 60 characters.');
    expect(screen.getByLabelText('Duration')).toHaveAccessibleDescription('Choose a duration from 15 to 120 minutes in 15-minute steps.');

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'academic ADVISING');
    await user.selectOptions(screen.getByLabelText('Duration'), '30 min');
    await user.click(screen.getByRole('button', { name: 'Add service' }));
    expect(await screen.findByText('A service with this name already exists.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('academic ADVISING'); // values kept after an error
    expect(posts[1]).toEqual({ name: 'academic ADVISING', durationMin: 30 });

    await user.click(within(row).getByRole('button', { name: 'Deactivate Academic advising' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate Academic advising?' });
    expect(dialog).toHaveTextContent('Customers will no longer be able to book its open slots. Existing bookings stay.');
    await user.click(within(dialog).getByRole('button', { name: 'Yes, deactivate' }));
    expect(patches).toEqual([{ isActive: false }]);
    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivate Academic advising' })).toBeInTheDocument();
  });
});
