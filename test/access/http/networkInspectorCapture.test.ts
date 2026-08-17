/**
 * Tier 1 — MSW faking the network. Proves the capture interceptor records request
 * and response detail (method, url, headers, payload, status, duration) into the
 * network inspector store, redacts sensitive headers, and marks failures.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { createHttpClient } from '../../../src/access/http/createHttpClient';
import { ServerError } from '../../../src/access/http/errors';
import { InMemoryNetworkInspector } from '../../../src/access/http/NetworkInspector';
import { MockTokenProvider } from '../../../src/access/http/TokenProvider';
import { MockLogger } from '../../../src/access/logger/MockLogger';

const BASE_URL = 'https://api.test';

const server = setupServer(
  http.get(`${BASE_URL}/ok`, () => HttpResponse.json({ value: 42 })),
  http.post(`${BASE_URL}/echo`, async ({ request }) => HttpResponse.json(await request.json())),
  http.get(`${BASE_URL}/boom`, () => new HttpResponse(null, { status: 500 })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeClient(inspector: InMemoryNetworkInspector) {
  return createHttpClient({
    baseUrl: BASE_URL,
    logger: new MockLogger(),
    tokenProvider: new MockTokenProvider(),
    enableLogging: false,
    networkRecorder: inspector,
  });
}

describe('network inspector capture', () => {
  it('captures a successful GET with status, duration, and response body', async () => {
    const inspector = new InMemoryNetworkInspector();
    const client = makeClient(inspector);

    await client.get('/ok');

    const [exchange] = inspector.getExchanges();
    expect(exchange).toMatchObject({ method: 'GET', url: '/ok', state: 'success', status: 200 });
    expect(exchange.responseBody).toContain('42');
    expect(typeof exchange.durationMs).toBe('number');
    expect(exchange.responseHeaders?.['content-type']).toContain('application/json');
  });

  it('captures the request payload on a POST', async () => {
    const inspector = new InMemoryNetworkInspector();
    const client = makeClient(inspector);

    await client.post('/echo', { hello: 'world' });

    const [exchange] = inspector.getExchanges();
    expect(exchange.method).toBe('POST');
    expect(exchange.requestBody).toContain('world');
  });

  it('redacts sensitive request headers', async () => {
    const inspector = new InMemoryNetworkInspector();
    const client = makeClient(inspector);

    await client.get('/ok', { headers: { Authorization: 'Bearer super-secret' } });

    const [exchange] = inspector.getExchanges();
    const values = Object.values(exchange.requestHeaders);
    expect(values).not.toContain('Bearer super-secret');
    expect(values).toContain('***');
  });

  it('records a failed request with its error kind', async () => {
    const inspector = new InMemoryNetworkInspector();
    const client = makeClient(inspector);

    await expect(client.get('/boom')).rejects.toBeInstanceOf(ServerError);

    const [exchange] = inspector.getExchanges();
    expect(exchange).toMatchObject({ state: 'failure', status: 500, errorKind: 'server' });
  });
});
