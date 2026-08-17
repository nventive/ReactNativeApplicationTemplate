/**
 * Tier 1 — plain TS. The controllable remote-config mock the diagnostics overlay
 * and the operational features build on.
 */
import { MockRemoteConfigProvider } from '../../../src/access/remoteConfig/MockRemoteConfigProvider';
import type { RemoteConfigValues } from '../../../src/access/remoteConfig/RemoteConfig';
import { compareVersions, version } from '../../../src/access/version/Version';

describe('MockRemoteConfigProvider', () => {
  it('seeds the safe defaults (1.0.0 / kill switch off)', () => {
    const provider = new MockRemoteConfigProvider();

    const values = provider.getValues();
    expect(compareVersions(values.minimumVersion, version(1, 0, 0))).toBe(0);
    expect(values.killSwitchActive).toBe(false);
  });

  it('emits the current values immediately and on every change', () => {
    const provider = new MockRemoteConfigProvider();
    const emitted: RemoteConfigValues[] = [];
    const sub = provider.values$.subscribe((v) => emitted.push(v));

    provider.setMinimumVersion(version(2, 0, 0));
    provider.setKillSwitchActive(true);

    expect(emitted).toHaveLength(3); // initial + 2 changes
    expect(compareVersions(emitted[1].minimumVersion, version(2, 0, 0))).toBe(0);
    expect(emitted[2].killSwitchActive).toBe(true);
    sub.unsubscribe();
  });

  it('toggleKillSwitch flips the current flag', () => {
    const provider = new MockRemoteConfigProvider();

    provider.toggleKillSwitch();
    expect(provider.getValues().killSwitchActive).toBe(true);

    provider.toggleKillSwitch();
    expect(provider.getValues().killSwitchActive).toBe(false);
  });

  it('refresh is a no-op that resolves', async () => {
    const provider = new MockRemoteConfigProvider();
    await expect(provider.refresh()).resolves.toBeUndefined();
  });
});
