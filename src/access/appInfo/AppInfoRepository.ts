/**
 * The running app's identity, as display-ready strings (diagnostics, an about
 * screen). Distinct from {@link CurrentVersionRepository}, which parses the
 * version into a comparable {@link Version} for the forced-update gate — this
 * carries the marketing version *and* the native build number for display.
 */
export interface AppInfo {
  /** Display name from `app.config.ts` (`name`). */
  readonly name: string;
  /** Marketing/semver version, e.g. `1.0.0` (iOS `CFBundleShortVersionString` / Android `versionName`). */
  readonly version: string;
  /** Native build number, e.g. `42` (iOS `CFBundleVersion` / Android `versionCode`). */
  readonly buildNumber: string;
  /** Bundle identifier / package name, e.g. `com.acme.app` (iOS bundle id / Android application id). */
  readonly bundleId: string;
  /** OS the build is running on, e.g. `ios` / `android` (`Platform.OS`). */
  readonly platform: string;
  /** OS version, e.g. `17.2` (iOS) or `14 (API 34)` (Android) — the device this build is running on. */
  readonly osVersion: string;
}

/**
 * Reads the running app's identity for display. An Access interface with a real
 * (expo-application, reading the native binary) and a mock implementation so
 * screens can show the version without a device and the read stays Tier-1 testable.
 */
export interface AppInfoRepository {
  /** The name, version, and build number this build is running. */
  getAppInfo(): AppInfo;
}
