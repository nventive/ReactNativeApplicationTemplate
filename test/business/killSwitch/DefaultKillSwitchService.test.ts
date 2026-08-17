/**
 * Tier 1 — plain TS. The kill switch is a thin derivation of the remote-config
 * stream down to the boolean flag, deduped so only distinct changes emit.
 */
import { MockRemoteConfigProvider } from '../../../src/access/remoteConfig/MockRemoteConfigProvider';
import { version } from '../../../src/access/version/Version';
import { DefaultKillSwitchService } from '../../../src/business/killSwitch/DefaultKillSwitchService';

describe('DefaultKillSwitchService', () => {
  it('starts inactive with the default config', () => {
    const remoteConfig = new MockRemoteConfigProvider();
    const service = new DefaultKillSwitchService(remoteConfig);

    let value: boolean | undefined;
    const sub = service.isKillSwitchActive$.subscribe((v) => (value = v));
    expect(value).toBe(false);
    sub.unsubscribe();
  });

  it('reflects the remote flag and recovers when it lifts', () => {
    const remoteConfig = new MockRemoteConfigProvider();
    const service = new DefaultKillSwitchService(remoteConfig);
    const emitted: boolean[] = [];
    const sub = service.isKillSwitchActive$.subscribe((v) => emitted.push(v));

    remoteConfig.setKillSwitchActive(true);
    remoteConfig.setKillSwitchActive(false);

    expect(emitted).toEqual([false, true, false]);
    sub.unsubscribe();
  });

  it('ignores config changes that leave the kill flag unchanged (distinct)', () => {
    const remoteConfig = new MockRemoteConfigProvider();
    const service = new DefaultKillSwitchService(remoteConfig);
    const emitted: boolean[] = [];
    const sub = service.isKillSwitchActive$.subscribe((v) => emitted.push(v));

    // A minimum-version change must not re-emit the (unchanged) kill flag.
    remoteConfig.setMinimumVersion(version(3, 0, 0));

    expect(emitted).toEqual([false]);
    sub.unsubscribe();
  });
});
