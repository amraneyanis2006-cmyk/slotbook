import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/auth/AuthProvider';
import LoginPage from '../src/pages/LoginPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/book" element={<p>Book a Slot page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('LoginPage (F-01)', () => {
  it('UI-01: labelled form, busy button, 401 keeps e-mail and clears password, 200 goes to the role home', async () => {
    let finishLogin: (r: Response) => void = () => {};
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/auth/me') return Promise.resolve(json(401, { error: 'UNAUTHENTICATED', message: 'Please log in.' }));
      return new Promise<Response>((resolve) => { finishLogin = resolve; });
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderLogin();

    const email = await screen.findByLabelText('Email');
    const password = screen.getByLabelText('Password');
    const button = screen.getByRole('button', { name: 'Log in' });

    await user.type(email, 'cust.ploy@slotbook.test');
    await user.type(password, 'wrong-password');
    await user.click(button);
    expect(button).toBeDisabled();

    finishLogin(json(401, { error: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(email).toHaveValue('cust.ploy@slotbook.test');
    expect(password).toHaveValue('');
    expect(button).toBeEnabled();

    await user.type(password, 'right-password');
    await user.click(button);
    finishLogin(json(200, { user: { id: 3, name: 'Ploy Chai', email: 'cust.ploy@slotbook.test', role: 'CUSTOMER' } }));

    expect(await screen.findByText('Book a Slot page')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' })));
  });
});
