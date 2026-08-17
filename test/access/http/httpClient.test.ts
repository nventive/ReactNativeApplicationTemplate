/**
 * Tier 1 — MSW faking the network. Drives the configured axios client through a
 * throwaway API to prove the interceptor chain: success, error mapping, and the
 * single-flight auth-refresh-and-retry flow. No real feature repository is
 * involved.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { createHttpClient, DEFAULT_USER_AGENT } from '../../../src/access/http/createHttpClient';
import { NetworkError, ServerError, UnauthorizedError } from '../../../src/access/http/errors';
import type { TokenProvider } from '../../../src/access/http/TokenProvider';
import { MockLogger } from '../../../src/access/logger/MockLogger';

const BASE_URL = 'https://api.test';

/** Stateful token provider so the refresh flow can be asserted. */
class TestTokenProvider implements TokenProvider {
  refreshCalls = 0;
  sessionExpiredCalls = 0;

  constructor(
    private token: string | null,
    private readonly nextToken: string | null,
  ) {}

  getToken(): Promise<string | null> {
    return Promise.resolve(this.token);
  }

  async refreshToken(): Promise<string | null> {
    this.refreshCalls += 1;
    // Small delay so concurrent 401s overlap on the single in-flight refresh.
    await new Promise((resolve) => setTimeout(resolve, 10));
    this.token = this.nextToken;
    return this.nextToken;
  }

  onSessionExpired(): void {
    this.sessionExpiredCalls += 1;
    this.token = null;
  }
}

const server = setupServer(
  http.get(`${BASE_URL}/ok`, () => HttpResponse.json({ value: 42 })),
  http.get(`${BASE_URL}/boom`, () => new HttpResponse(null, { status: 500 })),
  http.get(`${BASE_URL}/down`, () => HttpResponse.error()),
  http.get(`${BASE_URL}/secure`, ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (auth === 'Bearer fresh') {
      return HttpResponse.json({ value: 'ok' });
    }
    return new HttpResponse(null, { status: 401 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeClient(tokenProvider: TokenProvider) {
  return createHttpClient({
    baseUrl: BASE_URL,
    logger: new MockLogger(),
    tokenProvider,
    // Disable logging noise; error mapping still runs.
    enableLogging: false,
  });
}

describe('createHttpClient', () => {
  it('resolves a successful response', async () => {
    const client = makeClient(new TestTokenProvider(null, null));

    const response = await client.get('/ok');

    expect(response.data).toEqual({ value: 42 });
  });

  it('sends a descriptive User-Agent on every request', async () => {
    let userAgent: string | null = null;
    server.use(
      http.get(`${BASE_URL}/ua`, ({ request }) => {
        userAgent = request.headers.get('user-agent');
        return HttpResponse.json({ ok: true });
      }),
    );
    const client = makeClient(new TestTokenProvider(null, null));

    await client.get('/ua');

    expect(userAgent).toBe(DEFAULT_USER_AGENT);
  });

  it('lets the caller override the User-Agent', async () => {
    let userAgent: string | null = null;
    server.use(
      http.get(`${BASE_URL}/ua`, ({ request }) => {
        userAgent = request.headers.get('user-agent');
        return HttpResponse.json({ ok: true });
      }),
    );
    const client = createHttpClient({
      baseUrl: BASE_URL,
      logger: new MockLogger(),
      tokenProvider: new TestTokenProvider(null, null),
      enableLogging: false,
      userAgent: 'CustomApp/9.9',
    });

    await client.get('/ua');

    expect(userAgent).toBe('CustomApp/9.9');
  });

  it('maps a 5xx response to ServerError', async () => {
    const client = makeClient(new TestTokenProvider(null, null));

    await expect(client.get('/boom')).rejects.toBeInstanceOf(ServerError);
    await expect(client.get('/boom')).rejects.toMatchObject({ status: 500 });
  });

  it('maps a transport failure to NetworkError', async () => {
    const client = makeClient(new TestTokenProvider(null, null));

    await expect(client.get('/down')).rejects.toBeInstanceOf(NetworkError);
  });

  it('refreshes the token on 401 and retries once', async () => {
    const tokenProvider = new TestTokenProvider('stale', 'fresh');
    const client = makeClient(tokenProvider);

    const response = await client.get('/secure');

    expect(response.data).toEqual({ value: 'ok' });
    expect(tokenProvider.refreshCalls).toBe(1);
    expect(tokenProvider.sessionExpiredCalls).toBe(0);
  });

  it('surfaces UnauthorizedError and signals session expiry when refresh fails', async () => {
    const tokenProvider = new TestTokenProvider('stale', null);
    const client = makeClient(tokenProvider);

    await expect(client.get('/secure')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(tokenProvider.sessionExpiredCalls).toBe(1);
  });

  it('coalesces concurrent 401s onto a single refresh (single-flight)', async () => {
    const tokenProvider = new TestTokenProvider('stale', 'fresh');
    const client = makeClient(tokenProvider);

    const [a, b] = await Promise.all([client.get('/secure'), client.get('/secure')]);

    expect(a.data).toEqual({ value: 'ok' });
    expect(b.data).toEqual({ value: 'ok' });
    expect(tokenProvider.refreshCalls).toBe(1);
  });
});
