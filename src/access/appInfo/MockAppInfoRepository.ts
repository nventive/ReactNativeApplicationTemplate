import type { AppInfo, AppInfoRepository } from './AppInfoRepository';

/**
 * Fixed {@link AppInfoRepository} for tests and fully-offline runs — construct it
 * with the identity a scenario needs; defaults to a `1.0.0 (1)` build.
 */
export class MockAppInfoRepository implements AppInfoRepository {
  constructor(
    private readonly info: AppInfo = {
      name: 'Test App',
      version: '1.0.0',
      buildNumber: '1',
      bundleId: 'com.example.testapp',
      platform: 'ios',
      osVersion: '17.0',
    },
  ) {}

  getAppInfo(): AppInfo {
    return this.info;
  }
}
