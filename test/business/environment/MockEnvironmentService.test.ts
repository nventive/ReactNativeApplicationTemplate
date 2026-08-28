/**
 * Tier 1 — plain TS. The mock is an LSP-faithful stand-in for the real service:
 * its `setEnvironment`/`reset` drive `pending$` the same way (including `reset()`
 * raising a pending change back to the build default), just without persistence.
 * These cases mirror `DefaultEnvironmentService.test.ts`.
 */
import { MockEnvironmentService } from '../../../src/business/environment/MockEnvironmentService';
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

describe('MockEnvironmentService', () => {
  it('starts on the initial environment with nothing pending', () => {
    const service = new MockEnvironmentService('staging');

    expect(service.getCurrent()).toBe('staging');
    expect(service.getConfig().name).toBe('staging');
    expect(firstEmission<Environment | null>(service.pending$)).toBeNull();
  });

  it('setEnvironment marks it pending without changing current', async () => {
    const service = new MockEnvironmentService('development');

    const pending: (Environment | null)[] = [];
    const sub = service.pending$.subscribe((p) => pending.push(p));

    await service.setEnvironment('production');

    expect(service.getCurrent()).toBe('development');
    expect(pending).toEqual([null, 'production']);
    sub.unsubscribe();
  });

  it('setEnvironment to the current environment clears the pending marker', async () => {
    const service = new MockEnvironmentService('development');

    await service.setEnvironment('production');
    await service.setEnvironment('development');

    expect(firstEmission<Environment | null>(service.pending$)).toBeNull();
  });

  it('reset clears pending when the build default is already current', async () => {
    const service = new MockEnvironmentService('development');

    await service.setEnvironment('production');
    await service.reset();

    expect(firstEmission<Environment | null>(service.pending$)).toBeNull();
  });

  it('reset raises the build default as pending when current came from an override', async () => {
    // Models a session launched from a persisted override: current is staging,
    // but the build default is development.
    const service = new MockEnvironmentService('staging', 'development');

    await service.reset();

    expect(service.getCurrent()).toBe('staging'); // unchanged until restart
    expect(firstEmission<Environment | null>(service.pending$)).toBe('development');
  });
});
