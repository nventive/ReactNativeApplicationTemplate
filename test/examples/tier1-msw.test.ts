/**
 * Tier 1 example — MSW intercepting the network.
 *
 * Proves the "fake at the edges" setup: MSW
 * owns the network in tests, so no test ever talks to a real backend. The HTTP
 * client (axios) and repositories are tested through this same
 * mechanism.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('https://example.test/greeting', () => HttpResponse.json({ message: 'hello' })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Tier 1 — MSW network faking', () => {
  it('intercepts a fetch and serves the faked response', async () => {
    const response = await fetch('https://example.test/greeting');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: 'hello' });
  });
});
