import type { Version } from '../version/Version';

/**
 * Reads the **installed** app version from the native package. Forced update
 * compares this against the remote minimum.
 *
 * It is an Access interface with a real + mock implementation so the comparison
 * logic stays Tier-1 testable without a device.
 */
export interface CurrentVersionRepository {
  /** The version this build is running, parsed from the app config / native package. */
  getCurrentVersion(): Promise<Version>;
}
