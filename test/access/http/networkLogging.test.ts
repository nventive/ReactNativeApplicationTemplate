/**
 * Tier 1 — MSW faking the network. Proves the HTTP interceptors tag their log
 * entries with the `network` category and structured meta, which is what lets the
 * in-app log console surface an HTTP inspector view with no separate
 * capture store.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { createHttpClient } from '../../../src/access/http/createHttpClient';
import { ServerError } from '../../../src/access/http/errors';
import { isNetworkLogEntry } from '../../../src/access/logger/LogCategory';
import { MockLogger } from '../../../src/access/logger/MockLogger';
import { MockTokenProvider } from '../../../src/access/http/TokenProvider';

const BASE_URL = 'https://api.test';

const server = setupServer(
  http.get(`${BASE_URL}/ok`, () => HttpResponse.json({ value: 42 })),
  http.get(`${BASE_URL}/boom`, () => new HttpResponse(null, { status: 500 })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeClient(logger: MockLogger) {
  return createHttpClient({
    baseUrl: BASE_URL,
    logger,
    tokenProvider: new MockTokenProvider(),
  });
}

describe('HTTP network logging', () => {
  it('tags request and response logs with the network category and meta', async () => {
    const logger = new MockLogger();
    const client = makeClient(logger);

    await client.get('/ok');

    const network = logger.entries.filter(isNetworkLogEntry);
    expect(network.length).toBeGreaterThanOrEqual(2); // request + response

    const response = network.find((e) => typeof e.meta?.status === 'number');
    expect(response?.meta).toMatchObject({ method: 'GET', status: 200, url: '/ok' });
    expect(typeof response?.meta?.durationMs).toBe('number');
  });

  it('tags a failed request log with the network category', async () => {
    const logger = new MockLogger();
    const client = makeClient(logger);

    await expect(client.get('/boom')).rejects.toBeInstanceOf(ServerError);

    const failure = logger.entriesOf('error').find(isNetworkLogEntry);
    expect(failure).toBeDefined();
    expect(failure?.meta).toMatchObject({ url: '/boom' });
  });
});
