/**
 * Tier 1 — MSW faking the network. Drives the real `HttpJokesRepository` through
 * the configured axios client against a faked Reddit endpoint to prove every
 * error path is typed (`doc/ErrorHandling.md`):
 * - success: the Reddit envelope is parsed and mapped to flat `Joke`s,
 * - 5xx → `ServerError` (from the client's error-mapping interceptor),
 * - transport failure → `NetworkError` (same interceptor),
 * - malformed 2xx body → `ParseError` (thrown by the repository at the boundary).
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { createHttpClient } from '../../../src/access/http/createHttpClient';
import { NetworkError, ParseError, ServerError } from '../../../src/access/http/errors';
import { MockTokenProvider } from '../../../src/access/http/TokenProvider';
import { HttpJokesRepository } from '../../../src/access/jokes/HttpJokesRepository';
import { MockLogger } from '../../../src/access/logger/MockLogger';

const BASE_URL = 'https://www.reddit.com/r/dadjokes';

/** A minimal but realistic slice of the real Reddit `/top.json` envelope. */
const validEnvelope = {
  kind: 'Listing',
  data: {
    after: null,
    children: [
      {
        kind: 't3',
        data: {
          id: '17urj7q',
          title: 'My wife just completed a 40 week body building program this morning',
          selftext: "It's a girl and weighs 7lbs 12 oz.",
          // Extra Reddit fields the schema must ignore.
          ups: 325,
          subreddit: 'dadjokes',
        },
      },
      {
        kind: 't3',
        data: {
          id: '17uebld',
          title: 'My family is getting sick of me telling dad jokes 24/7',
          selftext: 'Or should I say ...?',
          ups: 228,
        },
      },
    ],
  },
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeRepository() {
  const client = createHttpClient({
    baseUrl: BASE_URL,
    logger: new MockLogger(),
    tokenProvider: new MockTokenProvider(),
    enableLogging: false,
  });
  return new HttpJokesRepository(client);
}

describe('HttpJokesRepository', () => {
  it('parses the Reddit envelope and maps it to flat jokes', async () => {
    server.use(http.get(`${BASE_URL}/top.json`, () => HttpResponse.json(validEnvelope)));

    const jokes = await makeRepository().getJokes();

    expect(jokes).toEqual([
      {
        id: '17urj7q',
        title: 'My wife just completed a 40 week body building program this morning',
        text: "It's a girl and weighs 7lbs 12 oz.",
      },
      {
        id: '17uebld',
        title: 'My family is getting sick of me telling dad jokes 24/7',
        text: 'Or should I say ...?',
      },
    ]);
  });

  it('maps a server error to ServerError', async () => {
    server.use(http.get(`${BASE_URL}/top.json`, () => new HttpResponse(null, { status: 500 })));

    await expect(makeRepository().getJokes()).rejects.toBeInstanceOf(ServerError);
  });

  it('maps a transport failure to NetworkError', async () => {
    server.use(http.get(`${BASE_URL}/top.json`, () => HttpResponse.error()));

    await expect(makeRepository().getJokes()).rejects.toBeInstanceOf(NetworkError);
  });

  it('throws ParseError on a malformed payload (fail loud)', async () => {
    server.use(
      http.get(`${BASE_URL}/top.json`, () => HttpResponse.json({ data: { children: 'nope' } })),
    );

    await expect(makeRepository().getJokes()).rejects.toBeInstanceOf(ParseError);
  });
});
