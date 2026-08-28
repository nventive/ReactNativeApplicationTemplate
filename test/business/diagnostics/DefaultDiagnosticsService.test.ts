/**
 * Tier 1 — plain TS. Availability = environment default AND not permanently
 * disabled AND not session-dismissed; permanent disable persists, session
 * dismiss does not.
 */
import { InMemoryKeyValueStore } from '../../../src/access/storage/InMemoryKeyValueStore';
import {
  DefaultDiagnosticsService,
  DIAGNOSTICS_DISABLED_KEY,
} from '../../../src/business/diagnostics/DefaultDiagnosticsService';

describe('DefaultDiagnosticsService', () => {
  it('is available when the environment enables diagnostics', () => {
    const service = new DefaultDiagnosticsService(new InMemoryKeyValueStore(), true);
    expect(service.isAvailable()).toBe(true);
  });

  it('is unavailable in a production build (default disabled)', () => {
    const service = new DefaultDiagnosticsService(new InMemoryKeyValueStore(), false);
    expect(service.isAvailable()).toBe(false);
  });

  it('dismissForSession hides it without persisting', () => {
    const store = new InMemoryKeyValueStore();
    const service = new DefaultDiagnosticsService(store, true);

    service.dismissForSession();

    expect(service.isAvailable()).toBe(false);
    expect(store.contains(DIAGNOSTICS_DISABLED_KEY)).toBe(false);
    // A fresh service over the same store (a relaunch) is available again.
    expect(new DefaultDiagnosticsService(store, true).isAvailable()).toBe(true);
  });

  it('disablePermanently persists and survives a relaunch', () => {
    const store = new InMemoryKeyValueStore();
    const service = new DefaultDiagnosticsService(store, true);

    service.disablePermanently();

    expect(service.isAvailable()).toBe(false);
    expect(store.getBoolean(DIAGNOSTICS_DISABLED_KEY)).toBe(true);
    expect(new DefaultDiagnosticsService(store, true).isAvailable()).toBe(false);
  });

  it('emits availability changes to subscribers', () => {
    const service = new DefaultDiagnosticsService(new InMemoryKeyValueStore(), true);
    const emitted: boolean[] = [];
    const sub = service.isAvailable$.subscribe((v) => emitted.push(v));

    service.dismissForSession();

    expect(emitted).toEqual([true, false]);
    sub.unsubscribe();
  });
});
