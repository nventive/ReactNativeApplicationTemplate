import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { AppInfo, AppInfoRepository } from './AppInfoRepository';

/**
 * The running device's OS version as a display string. `Platform.Version` is the
 * OS version on iOS but the SDK/API level on Android, so Android is enriched with
 * the marketing release (`Platform.constants.Release`) when available — the value
 * you actually want when triaging a report off an unknown device.
 */
function readOsVersion(): string {
  if (Platform.OS === 'android') {
    const release = (Platform.constants as { Release?: string }).Release;
    return release ? `${release} (API ${Platform.Version})` : `API ${Platform.Version}`;
  }
  return String(Platform.Version);
}

/**
 * Reads the running app's identity from the **native binary** via
 * expo-application — the authoritative values the OS "App info" screen, the
 * stores, TestFlight, and crash reports all report:
 * - `applicationName` — the display name.
 * - `nativeApplicationVersion` — iOS `CFBundleShortVersionString` / Android `versionName`.
 * - `nativeBuildVersion` — iOS `CFBundleVersion` / Android `versionCode`.
 * - `applicationId` — the bundle identifier / package name.
 *
 * The platform and OS version come from react-native's `Platform` — the
 * device-side fields that matter when triaging a report off an unknown device.
 *
 * In CI these are stamped from GitVersion (`doc/AzurePipelines.md` §
 * "Versioning"); with Continuous Native Generation they equal `app.config.ts`'s
 * values, because `expo prebuild` writes them into the native projects — reading
 * the native side just guarantees we show what actually shipped.
 *
 * Falls back to the `app.config.ts` values surfaced by expo-constants, then to
 * safe placeholders, so the section still renders where the native getters are
 * unavailable (web, or a headless test).
 */
export class ExpoAppInfoRepository implements AppInfoRepository {
  getAppInfo(): AppInfo {
    const config = Constants.expoConfig;
    return {
      name: Application.applicationName ?? config?.name ?? 'App',
      version: Application.nativeApplicationVersion ?? config?.version ?? '1.0.0',
      buildNumber:
        Application.nativeBuildVersion ??
        config?.ios?.buildNumber ??
        config?.android?.versionCode?.toString() ??
        '1',
      bundleId:
        Application.applicationId ??
        config?.ios?.bundleIdentifier ??
        config?.android?.package ??
        'unknown',
      platform: Platform.OS,
      osVersion: readOsVersion(),
    };
  }
}
