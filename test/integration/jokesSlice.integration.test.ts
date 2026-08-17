/**
 * Headless integration test — the "boot the graph, fake the edges, drive
 * through services" pattern: it boots the real composition root with mocks
 * forced.
 *
 * Recipe:
 * 1. Build the REAL service graph via `createServices(...)`, overriding only
 *    the edges (here the repository; MSW covers the network once real HTTP
 *    repositories exist).
 * 2. Drive scenarios through the public service interfaces — no device, no UI,
 *    no React.
 * 3. Assert on returned data and on observable state emissions.
 *
 * This file is the reference for the pattern; it backs
 * `doc/Testing.md`'s integration-test section.
 */
import type { Joke } from '../../src/access/jokes/Joke';
import type { JokesRepository } from '../../src/access/jokes/JokesRepository';
import { createServices } from '../../src/framework/composition/createServices';

const fixtureJokes: Joke[] = [
  { id: 'i1', title: 'Integration joke 1', text: 'Text 1' },
  { id: 'i2', title: 'Integration joke 2', text: 'Text 2' },
];

class FakeJokesRepository implements JokesRepository {
  getJokes(): Promise<Joke[]> {
    return Promise.resolve(fixtureJokes);
  }
}

describe('Jokes slice (headless integration)', () => {
  it('fetches jokes and tracks favorites through the real service graph', async () => {
    // 1. Boot the real graph with the edge faked.
    const services = createServices({ jokesRepository: new FakeJokesRepository() });

    // 2. Drive the scenario through the service interface.
    const jokes = await services.jokes.fetchJokes();
    expect(jokes).toEqual(fixtureJokes);

    const emitted: Joke[][] = [];
    const subscription = services.jokes.favorites$.subscribe((favorites) =>
      emitted.push(favorites),
    );

    services.jokes.toggleFavorite(jokes[0]);
    services.jokes.toggleFavorite(jokes[1]);
    services.jokes.toggleFavorite(jokes[0]);

    // 3. Assert on the observable state the UI would render from.
    expect(emitted).toEqual([
      [],
      [fixtureJokes[0]],
      [fixtureJokes[0], fixtureJokes[1]],
      [fixtureJokes[1]],
    ]);
    subscription.unsubscribe();
  });
});
