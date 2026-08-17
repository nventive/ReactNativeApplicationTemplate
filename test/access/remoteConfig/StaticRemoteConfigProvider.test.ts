/**
 * Tier 1 — the defaults-only remote-config provider (the non-mock, pre-Firebase
 * path). It must always serve safe defaults and never block the app, and it has
 * no controls, so `remoteConfigController` is null when it is wired.
 */
import {
  REMOTE_CONFIG_DEFAULTS,
  type RemoteConfigValues,
} from '../../../src/access/remoteConfig/RemoteConfig';
import { StaticRemoteConfigProvider } from '../../../src/access/remoteConfig/StaticRemoteConfigProvider';
import { version } from '../../../src/access/version/Version';

describe('StaticRemoteConfigProvider', () => {
  it('serves the safe defaults when constructed with no values', () => {
    const provider = new StaticRemoteConfigProvider();

    expect(provider.getValues()).toEqual(REMOTE_CONFIG_DEFAULTS);
    expect(provider.getValues().killSwitchActive).toBe(false);
  });

  it('serves the values it was constructed with', () => {
    const values: RemoteConfigValues = { minimumVersion: version(2, 1, 0), killSwitchActive: true };
    const provider = new StaticRemoteConfigProvider(values);

    expect(provider.getValues()).toEqual(values);
  });

  it('emits the current values to a new subscriber and never changes them', () => {
    const provider = new StaticRemoteConfigProvider();
    const emitted: RemoteConfigValues[] = [];

    const sub = provider.values$.subscribe((v) => emitted.push(v));

    expect(emitted).toEqual([REMOTE_CONFIG_DEFAULTS]);
    expect(emitted[0]).toEqual(provider.getValues());
    sub.unsubscribe();
  });

  it('resolves refresh() as a no-op (no backend to fetch from)', async () => {
    const provider = new StaticRemoteConfigProvider();

    await expect(provider.refresh()).resolves.toBeUndefined();
    expect(provider.getValues()).toEqual(REMOTE_CONFIG_DEFAULTS);
  });
});
