/**
 * Tier 1 — plain TS, no React. The service is constructed directly with test
 * fakes (no composition root involved). The `KeyValueStore` is the in-memory
 * implementation, so favorite persistence/rehydration is exercised for real.
 */
import { RecordingAnalyticsSink } from '../../../src/access/analytics/RecordingAnalyticsSink';
import type { Joke } from '../../../src/access/jokes/Joke';
import type { JokesRepository } from '../../../src/access/jokes/JokesRepository';
import { InMemoryKeyValueStore } from '../../../src/access/storage/InMemoryKeyValueStore';
import type { KeyValueStore } from '../../../src/access/storage/KeyValueStore';
import { MockLogger } from '../../../src/access/logger/MockLogger';
import { DefaultJokesService } from '../../../src/business/jokes/DefaultJokesService';

const jokeA: Joke = { id: 'a', title: 'Joke A', text: 'Text A' };
const jokeB: Joke = { id: 'b', title: 'Joke B', text: 'Text B' };

const FAVORITES_KEY = 'jokes.favorites';

class FakeJokesRepository implements JokesRepository {
  getJokes(): Promise<Joke[]> {
    return Promise.resolve([jokeA, jokeB]);
  }
}

function makeService(store: KeyValueStore = new InMemoryKeyValueStore()) {
  const logger = new MockLogger();
  const analytics = new RecordingAnalyticsSink();
  const service = new DefaultJokesService(new FakeJokesRepository(), store, logger, analytics);
  return { service, store, logger, analytics };
}

describe('DefaultJokesService', () => {
  it('fetchJokes delegates to the repository', async () => {
    const { service } = makeService();

    await expect(service.fetchJokes()).resolves.toEqual([jokeA, jokeB]);
  });

  it('starts with no favorites', () => {
    const { service } = makeService();

    const emitted: Joke[][] = [];
    const subscription = service.favorites$.subscribe((favorites) => emitted.push(favorites));

    expect(emitted).toEqual([[]]);
    subscription.unsubscribe();
  });

  it('toggleFavorite adds then removes, emitting on every change', () => {
    const { service } = makeService();

    const emitted: Joke[][] = [];
    const subscription = service.favorites$.subscribe((favorites) => emitted.push(favorites));

    service.toggleFavorite(jokeA);
    service.toggleFavorite(jokeB);
    service.toggleFavorite(jokeA);

    expect(emitted).toEqual([[], [jokeA], [jokeA, jokeB], [jokeB]]);
    subscription.unsubscribe();
  });

  it('tracks a joke_favorited analytics event on every toggle', () => {
    const { service, analytics } = makeService();

    service.toggleFavorite(jokeA); // favorited
    service.toggleFavorite(jokeA); // unfavorited

    expect(analytics.recordsOf('event')).toEqual([
      { type: 'event', name: 'joke_favorited', data: { id: 'a', favorited: true } },
      { type: 'event', name: 'joke_favorited', data: { id: 'a', favorited: false } },
    ]);
  });

  it('emits immutable snapshots (a new list instance per change)', () => {
    const { service } = makeService();

    const emitted: Joke[][] = [];
    const subscription = service.favorites$.subscribe((favorites) => emitted.push(favorites));

    service.toggleFavorite(jokeA);

    expect(emitted[1]).not.toBe(emitted[0]);
    expect(emitted[0]).toEqual([]);
    subscription.unsubscribe();
  });

  it('replays the current favorites to late subscribers (BehaviorSubject semantics)', () => {
    const { service } = makeService();
    service.toggleFavorite(jokeA);

    const emitted: Joke[][] = [];
    const subscription = service.favorites$.subscribe((favorites) => emitted.push(favorites));

    expect(emitted).toEqual([[jokeA]]);
    subscription.unsubscribe();
  });

  describe('persistence', () => {
    it('persists favorites to the store on every toggle', () => {
      const { service, store } = makeService();

      service.toggleFavorite(jokeA);
      expect(JSON.parse(store.getString(FAVORITES_KEY) ?? '[]')).toEqual([jokeA]);

      service.toggleFavorite(jokeB);
      expect(JSON.parse(store.getString(FAVORITES_KEY) ?? '[]')).toEqual([jokeA, jokeB]);

      service.toggleFavorite(jokeA);
      expect(JSON.parse(store.getString(FAVORITES_KEY) ?? '[]')).toEqual([jokeB]);
    });

    it('rehydrates favorites from the store on construction', () => {
      const store = new InMemoryKeyValueStore();
      store.setString(FAVORITES_KEY, JSON.stringify([jokeA]));

      const { service } = makeService(store);

      const emitted: Joke[][] = [];
      const subscription = service.favorites$.subscribe((favorites) => emitted.push(favorites));

      expect(emitted).toEqual([[jokeA]]);
      subscription.unsubscribe();
    });

    it('survives a simulated restart (new service over the same store)', () => {
      const store = new InMemoryKeyValueStore();

      const first = makeService(store).service;
      first.toggleFavorite(jokeA);
      first.toggleFavorite(jokeB);

      // A fresh service over the same store = an app relaunch.
      const second = makeService(store).service;

      const emitted: Joke[][] = [];
      const subscription = second.favorites$.subscribe((favorites) => emitted.push(favorites));

      expect(emitted).toEqual([[jokeA, jokeB]]);
      subscription.unsubscribe();
    });

    it('fails soft on corrupt persisted data (logs a warning, starts empty)', () => {
      const store = new InMemoryKeyValueStore();
      store.setString(FAVORITES_KEY, 'not valid json {');

      const { service, logger } = makeService(store);

      const emitted: Joke[][] = [];
      const subscription = service.favorites$.subscribe((favorites) => emitted.push(favorites));

      expect(emitted).toEqual([[]]);
      expect(logger.entriesOf('warn')).toHaveLength(1);
      subscription.unsubscribe();
    });

    it('fails soft on schema-invalid persisted data', () => {
      const store = new InMemoryKeyValueStore();
      // Well-formed JSON, wrong shape (missing `text`).
      store.setString(FAVORITES_KEY, JSON.stringify([{ id: 'a', title: 'A' }]));

      const { service, logger } = makeService(store);

      expect(logger.entriesOf('warn')).toHaveLength(1);
      let value: Joke[] | undefined;
      const subscription = service.favorites$.subscribe((favorites) => (value = favorites));
      expect(value).toEqual([]);
      subscription.unsubscribe();
    });
  });
});
