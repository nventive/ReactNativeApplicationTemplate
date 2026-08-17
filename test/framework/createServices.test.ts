/**
 * Tier 1 — plain TS, no React. Proves the whole graph is
 * buildable in Node, and a fake can be injected through the overrides
 * parameter and observed through a service call.
 */
import { MockRemoteConfigProvider } from '../../src/access/remoteConfig/MockRemoteConfigProvider';
import type { Joke } from '../../src/access/jokes/Joke';
import type { JokesRepository } from '../../src/access/jokes/JokesRepository';
import { MockLogger } from '../../src/access/logger/MockLogger';
import { createServices } from '../../src/framework/composition/createServices';

const fakeJoke: Joke = { id: 'fake', title: 'Injected joke', text: 'From a fake repository' };

class FakeJokesRepository implements JokesRepository {
  getJokes(): Promise<Joke[]> {
    return Promise.resolve([fakeJoke]);
  }
}

describe('createServices', () => {
  it('builds the default (mock-backed) graph in Node', async () => {
    const services = createServices();

    const jokes = await services.jokes.fetchJokes();

    expect(jokes.length).toBeGreaterThan(0);
  });

  it('injects a fake repository through the overrides parameter', async () => {
    const services = createServices({ jokesRepository: new FakeJokesRepository() });

    await expect(services.jokes.fetchJokes()).resolves.toEqual([fakeJoke]);
  });

  it('replaces a whole service through the overrides parameter', async () => {
    const fakeService = {
      fetchJokes: () => Promise.resolve([fakeJoke]),
      favorites$: createServices().jokes.favorites$,
      toggleFavorite: () => {},
    };

    const services = createServices({ jokes: fakeService });

    expect(services.jokes).toBe(fakeService);
  });

  it('exposes the Phase-4 operational services on the graph', () => {
    const services = createServices();

    expect(services.remoteConfig).toBeDefined();
    expect(services.forcedUpdate).toBeDefined();
    expect(services.killSwitch).toBeDefined();
    expect(services.diagnostics).toBeDefined();
    expect(services.mocking).toBeDefined();
    expect(services.analytics).toBeDefined();
    expect(services.urlLauncher).toBeDefined();
    expect(services.appReview).toBeDefined();
  });

  it('exposes the logging service and, with diagnostics on, the in-app log buffer', () => {
    // Build default is development => diagnostics enabled => buffer present.
    const services = createServices();

    expect(services.logging).toBeDefined();
    expect(services.logging.getConsoleEnabled()).toBe(true);
    expect(services.logging.getFileEnabled()).toBe(true);
    expect(services.logBuffer).not.toBeNull();

    // Entries logged through the logger land in the in-app buffer.
    services.logger.info('hello console');
    expect(services.logBuffer?.getEntries().some((e) => e.message === 'hello console')).toBe(true);
  });

  it('exposes the network inspector when diagnostics is enabled', () => {
    // Build default is development => diagnostics enabled => inspector present.
    expect(createServices().networkInspector).not.toBeNull();
  });

  it('null-s the log buffer and reader when a logger override is supplied', () => {
    const services = createServices({ logger: new MockLogger() });

    expect(services.logBuffer).toBeNull();
    expect(services.logReader).toBeNull();
  });

  it('builds the real store-review gateway path when mocking is off', () => {
    // Exercises the non-mock branch (ExpoStoreReviewGateway construction +
    // expo-store-review import) so it can never regress to a broken import.
    const services = createServices({ mockingEnabled: false });
    expect(services.appReview).toBeDefined();
  });

  it('wires the mock remote-config controller only when mocking is enabled', () => {
    // Build default (development) => mocking on => controllable provider.
    expect(createServices().remoteConfigController).not.toBeNull();
    expect(createServices().mocking.isEnabled()).toBe(true);

    // Mocking off => static provider, no controls.
    const real = createServices({ mockingEnabled: false });
    expect(real.remoteConfigController).toBeNull();
    expect(real.mocking.isEnabled()).toBe(false);
  });

  it('exposes the controls of an injected controllable provider', () => {
    const services = createServices({
      mockingEnabled: false,
      remoteConfig: new MockRemoteConfigProvider(),
    });

    expect(services.remoteConfigController).not.toBeNull();
  });
});
