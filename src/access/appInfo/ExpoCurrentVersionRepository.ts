import Constants from 'expo-constants';

import { tryParseVersion, version, type Version } from '../version/Version';
import type { CurrentVersionRepository } from './CurrentVersionRepository';

/**
 * Reads the installed version from `app.config.ts`'s `version` field, surfaced
 * at runtime through expo-constants — the same source `getBuildDefaultEnvironment`
 * reads the environment from. The value is parsed once and cached.
 *
 * This is the only file that reads the app version from the platform. A project
 * that needs the true native build number (e.g. to compare against a store
 * minimum with a build component) swaps in an `expo-application` implementation
 * here — the interface and every consumer stay unchanged.
 */
export class ExpoCurrentVersionRepository implements CurrentVersionRepository {
  private cached: Version | undefined;

  getCurrentVersion(): Promise<Version> {
    if (this.cached === undefined) {
      const raw = Constants.expoConfig?.version;
      // Fall back to 1.0.0 if the config has no version — matches the remote
      // default, so a misconfigured build never wrongly forces an update.
      this.cached = (raw !== undefined ? tryParseVersion(raw) : undefined) ?? version(1, 0, 0);
    }
    return Promise.resolve(this.cached);
  }
}
