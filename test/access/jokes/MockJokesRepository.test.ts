/**
 * Tier 1 — plain TS, no React.
 */
import { jokeSchema } from '../../../src/access/jokes/Joke';
import { MockJokesRepository } from '../../../src/access/jokes/MockJokesRepository';

describe('MockJokesRepository', () => {
  it('returns the fixture jokes, leading with the pinned pair', async () => {
    const repository = new MockJokesRepository();

    const jokes = await repository.getJokes();

    expect(jokes.length).toBeGreaterThanOrEqual(2);
    // The first two fixtures are pinned to these exact ids.
    expect(jokes.slice(0, 2).map((joke) => joke.id)).toEqual(['17urj7q', '17uebld']);
    // Ids are unique so favorites keyed by id stay stable.
    expect(new Set(jokes.map((joke) => joke.id)).size).toBe(jokes.length);
  });

  it('serves fixtures that conform to the Joke zod schema', async () => {
    const repository = new MockJokesRepository();

    const jokes = await repository.getJokes();

    for (const joke of jokes) {
      expect(() => jokeSchema.parse(joke)).not.toThrow();
    }
  });
});
