import type { AxiosInstance } from 'axios';

import { ParseError } from '../http/errors';
import type { Joke } from './Joke';
import type { JokesRepository } from './JokesRepository';
import { jokesResponseSchema, toJokes } from './JokesResponse';

/** Path appended to the environment base URL (`…/r/dadjokes`). */
const TOP_JOKES_PATH = '/top.json';

/**
 * The real repository: fetches the top dad jokes from the public Reddit API
 * through the shared axios client. The base URL comes from the environment, so
 * the full request is `<apiBaseUrl>/top.json`.
 *
 * The response is parsed with a zod schema **at the boundary** — fail loud: an
 * unexpected payload becomes a typed `ParseError`, never partially-typed data
 * (`doc/Serialization.md`). Transport / server / auth failures are already
 * mapped to the typed taxonomy (`NetworkError`, `ServerError`, …) by the
 * client's error-mapping interceptor, so this repository only adds the parse
 * case and otherwise lets those propagate.
 */
export class HttpJokesRepository implements JokesRepository {
  constructor(private readonly client: AxiosInstance) {}

  async getJokes(): Promise<Joke[]> {
    const response = await this.client.get(TOP_JOKES_PATH);

    const parsed = jokesResponseSchema.safeParse(response.data);
    if (!parsed.success) {
      throw new ParseError(parsed.error.issues);
    }

    return toJokes(parsed.data);
  }
}
