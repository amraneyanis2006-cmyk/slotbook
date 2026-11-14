import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReleaseFooter from '../src/components/ReleaseFooter';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('ReleaseFooter (F-00, NFR-12)', () => {
  it('UI-05: shows "Release <first 7 characters>" of the commit from GET /api/version', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json(200, { commit: '0123456789abcdef0123456789abcdef01234567', revision: 'slotbook-00002-abc' })));
    vi.stubGlobal('fetch', fetchMock);
    render(<ReleaseFooter />);

    expect(await screen.findByRole('contentinfo')).toHaveTextContent('Release 0123456');
    expect(fetchMock).toHaveBeenCalledWith('/api/version', expect.anything());
  });

  it('UI-05: renders nothing when /api/version is missing (an image older than the endpoint)', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json(404, { error: 'NOT_FOUND', message: 'Not found.' })));
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<ReleaseFooter />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
