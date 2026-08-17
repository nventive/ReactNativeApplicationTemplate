import type { Joke } from './Joke';

/**
 * Data contract for the Dad Jokes feature.
 *
 * Implementations: `MockJokesRepository` (fixture data, no backend) and
 * `HttpJokesRepository` (axios against the public Dad Jokes API).
 * Consumers depend on this interface only; the composition root picks the
 * implementation.
 */
export interface JokesRepository {
  getJokes(): Promise<Joke[]>;
}
