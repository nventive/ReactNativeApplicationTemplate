/**
 * Tier 1 — the native Firebase gateway with the optional SDK **absent** (the
 * default template state). It must report unavailable and no-op safely rather
 * than crash the graph, so the composition root can fall back to the static
 * provider. The SDK-present behaviour is exercised through the provider's fake
 * gateway (see FirebaseRemoteConfigProvider.test.ts) and on-device.
 */
import { FirebaseRemoteConfigGateway } from '../../../src/access/remoteConfig/FirebaseRemoteConfigGateway';

describe('FirebaseRemoteConfigGateway (SDK not installed)', () => {
  it('reports unavailable and no-ops without throwing', async () => {
    const gateway = new FirebaseRemoteConfigGateway();

    expect(gateway.isAvailable).toBe(false);
    expect(gateway.getString('minimum_version')).toBeUndefined();
    expect(gateway.getBoolean('is_kill_switch_active')).toBeUndefined();
    await expect(
      gateway.configure({
        defaults: {},
        minimumFetchIntervalMillis: 60_000,
        fetchTimeoutMillis: 60_000,
      }),
    ).resolves.toBeUndefined();
    await expect(gateway.fetchAndActivate()).resolves.toBeUndefined();

    const unsubscribe = gateway.onConfigUpdated(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
