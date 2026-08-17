/**
 * Tier 1 — plain TS. Covers the runtime logging toggles: the startup resolver
 * (persisted override over the environment defaults) and the service's
 * persist-now / apply-on-restart behavior with its pending-change banner.
 */
import { InMemoryKeyValueStore } from '../../../src/access/storage/InMemoryKeyValueStore';
import type { EnvironmentConfig } from '../../../src/business/environment/EnvironmentService';
import {
  DefaultLoggingService,
  LOGGING_CONSOLE_KEY,
  LOGGING_FILE_KEY,
  resolveLoggingSettings,
} from '../../../src/business/logging/DefaultLoggingService';

/** A minimal env config with the logging block the resolver reads. */
function configWith(console: boolean, file: boolean): EnvironmentConfig {
  return {
    logging: { console, file, minimumLevel: 'debug' },
  } as EnvironmentConfig;
}

describe('resolveLoggingSettings', () => {
  it('falls back to the environment defaults when nothing is persisted', () => {
    const store = new InMemoryKeyValueStore();

    expect(resolveLoggingSettings(store, configWith(true, false))).toEqual({
      console: true,
      file: false,
    });
  });

  it('lets a persisted override win over the environment default', () => {
    const store = new InMemoryKeyValueStore();
    store.setBoolean(LOGGING_CONSOLE_KEY, false);
    store.setBoolean(LOGGING_FILE_KEY, true);

    expect(resolveLoggingSettings(store, configWith(true, false))).toEqual({
      console: false,
      file: true,
    });
  });
});

describe('DefaultLoggingService', () => {
  it('exposes the startup values and no pending change initially', () => {
    const service = new DefaultLoggingService(new InMemoryKeyValueStore(), {
      console: true,
      file: false,
    });

    expect(service.getConsoleEnabled()).toBe(true);
    expect(service.getFileEnabled()).toBe(false);

    const pending: boolean[] = [];
    const sub = service.hasPendingChange$.subscribe((v) => pending.push(v));
    expect(pending.at(-1)).toBe(false);
    sub.unsubscribe();
  });

  it('persists a toggle and raises the pending banner until reverted', () => {
    const store = new InMemoryKeyValueStore();
    const service = new DefaultLoggingService(store, { console: true, file: true });

    const pending: boolean[] = [];
    const sub = service.hasPendingChange$.subscribe((v) => pending.push(v));

    service.setFileEnabled(false);
    expect(store.getBoolean(LOGGING_FILE_KEY)).toBe(false);
    expect(service.getFileEnabled()).toBe(false);
    expect(pending.at(-1)).toBe(true);

    // Reverting to the startup value clears the banner again.
    service.setFileEnabled(true);
    expect(pending.at(-1)).toBe(false);
    sub.unsubscribe();
  });

  it('tracks pending across both toggles independently', () => {
    const service = new DefaultLoggingService(new InMemoryKeyValueStore(), {
      console: true,
      file: true,
    });

    const pending: boolean[] = [];
    const sub = service.hasPendingChange$.subscribe((v) => pending.push(v));

    service.setConsoleEnabled(false); // console differs → pending
    service.setConsoleEnabled(true); // back to startup, file unchanged → not pending
    expect(pending.at(-1)).toBe(false);
    sub.unsubscribe();
  });
});
