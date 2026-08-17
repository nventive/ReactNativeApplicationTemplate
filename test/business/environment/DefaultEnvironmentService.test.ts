/**
 * Tier 1 — plain TS. Drives the environment service directly with an in-memory
 * store; no expo-constants, no native modules.
 */
import { InMemoryKeyValueStore } from '../../../src/access/storage/InMemoryKeyValueStore';
import {
  DefaultEnvironmentService,
  ENVIRONMENT_OVERRIDE_KEY,
} from '../../../src/business/environment/DefaultEnvironmentService';
import type { Environment } from '../../../src/business/environment/EnvironmentService';

function firstEmission<T>(observable: {
  subscribe: (fn: (v: T) => void) => { unsubscribe(): void };
}): T {
  let value!: T;
  const sub = observable.subscribe((v) => {
    value = v;
  });
  sub.unsubscribe();
  return value;
}

describe('DefaultEnvironmentService', () => {
  it('uses the build default when no override is persisted', () => {
    const store = new InMemoryKeyValueStore();
    const service = new DefaultEnvironmentService(store, 'production');

    expect(service.getCurrent()).toBe('production');
    expect(service.getConfig().name).toBe('production');
    expect(firstEmission<Environment>(service.current$)).toBe('production');
  });

  it('a persisted override wins over the build default at startup', () => {
    const store = new InMemoryKeyValueStore();
    store.setString(ENVIRONMENT_OVERRIDE_KEY, 'staging');

    const service = new DefaultEnvironmentService(store, 'development');

    expect(service.getCurrent()).toBe('staging');
  });

  it('ignores an invalid persisted override and falls back to the build default', () => {
    const store = new InMemoryKeyValueStore();
    store.setString(ENVIRONMENT_OVERRIDE_KEY, 'not-a-real-env');

    const service = new DefaultEnvironmentService(store, 'development');

    expect(service.getCurrent()).toBe('development');
  });

  it('setEnvironment persists the override and marks it pending without changing current', async () => {
    const store = new InMemoryKeyValueStore();
    const service = new DefaultEnvironmentService(store, 'development');

    const pending: (Environment | null)[] = [];
    const sub = service.pending$.subscribe((p) => pending.push(p));

    await service.setEnvironment('production');

    expect(store.getString(ENVIRONMENT_OVERRIDE_KEY)).toBe('production');
    expect(service.getCurrent()).toBe('development'); // unchanged until restart
    expect(pending).toEqual([null, 'production']);
    sub.unsubscribe();
  });

  it('setEnvironment to the current environment clears the pending marker', async () => {
    const store = new InMemoryKeyValueStore();
    const service = new DefaultEnvironmentService(store, 'development');

    await service.setEnvironment('production');
    await service.setEnvironment('development');

    expect(firstEmission<Environment | null>(service.pending$)).toBeNull();
  });

  it('reset removes the override and points the next launch at the build default', async () => {
    const store = new InMemoryKeyValueStore();
    store.setString(ENVIRONMENT_OVERRIDE_KEY, 'staging');
    const service = new DefaultEnvironmentService(store, 'development');

    await service.reset();

    expect(store.contains(ENVIRONMENT_OVERRIDE_KEY)).toBe(false);
    // current is still staging this session; the build default is pending.
    expect(service.getCurrent()).toBe('staging');
    expect(firstEmission<Environment | null>(service.pending$)).toBe('development');
  });
});
