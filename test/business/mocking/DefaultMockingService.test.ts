/**
 * Tier 1 — plain TS. The persisted real-vs-mock flag and its restart-to-apply
 * "pending" banner, plus the startup resolver the composition root uses.
 */
import { InMemoryKeyValueStore } from '../../../src/access/storage/InMemoryKeyValueStore';
import {
  DefaultMockingService,
  MOCKING_ENABLED_KEY,
  resolveMockingEnabled,
} from '../../../src/business/mocking/DefaultMockingService';

describe('resolveMockingEnabled', () => {
  it('defaults to mocks in development and real elsewhere', () => {
    const store = new InMemoryKeyValueStore();
    expect(resolveMockingEnabled(store, 'development')).toBe(true);
    expect(resolveMockingEnabled(store, 'staging')).toBe(false);
    expect(resolveMockingEnabled(store, 'production')).toBe(false);
  });

  it('honors a persisted override over the environment default', () => {
    const store = new InMemoryKeyValueStore();
    store.setBoolean(MOCKING_ENABLED_KEY, true);
    expect(resolveMockingEnabled(store, 'production')).toBe(true);

    store.setBoolean(MOCKING_ENABLED_KEY, false);
    expect(resolveMockingEnabled(store, 'development')).toBe(false);
  });
});

describe('DefaultMockingService', () => {
  it('reports the startup value and no pending change initially', () => {
    const service = new DefaultMockingService(new InMemoryKeyValueStore(), true);
    expect(service.isEnabled()).toBe(true);

    let pending: boolean | undefined;
    const sub = service.hasPendingChange$.subscribe((v) => (pending = v));
    expect(pending).toBe(false);
    sub.unsubscribe();
  });

  it('persists a change and marks it pending (restart to apply)', () => {
    const store = new InMemoryKeyValueStore();
    const service = new DefaultMockingService(store, true);

    const pending: boolean[] = [];
    const sub = service.hasPendingChange$.subscribe((v) => pending.push(v));

    service.setEnabled(false);

    expect(store.getBoolean(MOCKING_ENABLED_KEY)).toBe(false);
    expect(service.isEnabled()).toBe(false);
    expect(pending).toEqual([false, true]);
    sub.unsubscribe();
  });

  it('clears the pending flag when toggled back to the startup value', () => {
    const service = new DefaultMockingService(new InMemoryKeyValueStore(), true);

    service.toggle(); // -> false, pending
    service.toggle(); // -> true again, matches startup

    let pending: boolean | undefined;
    const sub = service.hasPendingChange$.subscribe((v) => (pending = v));
    expect(pending).toBe(false);
    sub.unsubscribe();
  });
});
