/**
 * Tier 1 — plain TS. Drives the forced-update comparison directly with the
 * controllable remote-config mock and a fixed installed version.
 */
import { MockCurrentVersionRepository } from '../../../src/access/appInfo/MockCurrentVersionRepository';
import { MockRemoteConfigProvider } from '../../../src/access/remoteConfig/MockRemoteConfigProvider';
import { version } from '../../../src/access/version/Version';
import { DefaultForcedUpdateService } from '../../../src/business/forcedUpdate/DefaultForcedUpdateService';

async function collect(service: DefaultForcedUpdateService, run: () => void): Promise<boolean[]> {
  const emitted: boolean[] = [];
  const sub = service.isUpdateRequired$.subscribe((v) => emitted.push(v));
  // Let the async current-version read resolve before/while driving the mock.
  await Promise.resolve();
  run();
  await Promise.resolve();
  sub.unsubscribe();
  return emitted;
}

describe('DefaultForcedUpdateService', () => {
  it('does not require an update when the installed version meets the minimum', async () => {
    const remoteConfig = new MockRemoteConfigProvider(); // minimum 1.0.0
    const currentVersion = new MockCurrentVersionRepository(version(1, 0, 0));
    const service = new DefaultForcedUpdateService(remoteConfig, currentVersion);

    const emitted = await collect(service, () => {});
    expect(emitted.at(-1)).toBe(false);
  });

  it('requires an update once the remote minimum exceeds the installed version', async () => {
    const remoteConfig = new MockRemoteConfigProvider();
    const currentVersion = new MockCurrentVersionRepository(version(1, 0, 0));
    const service = new DefaultForcedUpdateService(remoteConfig, currentVersion);

    const emitted = await collect(service, () => remoteConfig.setMinimumVersion(version(2, 0, 0)));

    expect(emitted).toContain(true);
    expect(emitted.at(-1)).toBe(true);
  });

  it('lifts the requirement when the minimum drops back down (recoverable)', async () => {
    const remoteConfig = new MockRemoteConfigProvider();
    const currentVersion = new MockCurrentVersionRepository(version(1, 5, 0));
    const service = new DefaultForcedUpdateService(remoteConfig, currentVersion);

    const emitted = await collect(service, () => {
      remoteConfig.setMinimumVersion(version(2, 0, 0)); // blocks
      remoteConfig.setMinimumVersion(version(1, 0, 0)); // lifts
    });

    expect(emitted.at(-1)).toBe(false);
    expect(emitted).toContain(true); // it did block in between
  });
});
