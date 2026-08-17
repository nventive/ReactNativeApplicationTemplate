import type { Environment, EnvironmentConfig } from './EnvironmentService';

/**
 * The per-environment configuration map — a typed config for each environment.
 *
 * Each entry carries:
 * - logging console/file flags and minimum level per environment,
 * - the public Dad Jokes (Reddit) base URL,
 * - diagnostics enabled everywhere except production,
 * - crash reporting (Bugsee) enabled on internal builds (dev/staging), never
 *   production — it is billed per user (see `doc/CrashReporting.md`),
 * - the Firebase Remote Config fetch interval (short in dev/staging, long in
 *   production),
 * - placeholder store URLs for forced update (replaced per project).
 *
 * The base URL is intentionally the same across environments here because the
 * sample feature hits a single public API; a real app points dev/staging/prod
 * at different backends by editing these three entries.
 */
export const ENVIRONMENT_CONFIGS: Record<Environment, EnvironmentConfig> = {
  development: {
    name: 'development',
    label: 'Development',
    apiBaseUrl: 'https://www.reddit.com/r/dadjokes',
    diagnosticsEnabled: true,
    crashReportingEnabled: true,
    logging: { console: true, file: true, minimumLevel: 'debug' },
    remoteConfig: { fetchIntervalMinutes: 1 },
    appStoreUrl: {
      ios: 'https://apps.apple.com/app/id0000000000',
      android:
        'https://play.google.com/store/apps/details?id=com.nventive.internal.reactnativeapptemplate',
    },
  },
  staging: {
    name: 'staging',
    label: 'Staging',
    apiBaseUrl: 'https://www.reddit.com/r/dadjokes',
    diagnosticsEnabled: true,
    crashReportingEnabled: true,
    logging: { console: false, file: true, minimumLevel: 'info' },
    remoteConfig: { fetchIntervalMinutes: 1 },
    appStoreUrl: {
      ios: 'https://apps.apple.com/app/id0000000000',
      android:
        'https://play.google.com/store/apps/details?id=com.nventive.internal.reactnativeapptemplate',
    },
  },
  production: {
    name: 'production',
    label: 'Production',
    apiBaseUrl: 'https://www.reddit.com/r/dadjokes',
    diagnosticsEnabled: false,
    crashReportingEnabled: false,
    logging: { console: false, file: true, minimumLevel: 'warn' },
    remoteConfig: { fetchIntervalMinutes: 720 },
    appStoreUrl: {
      ios: 'https://apps.apple.com/app/id0000000000',
      android:
        'https://play.google.com/store/apps/details?id=com.nventive.internal.reactnativeapptemplate',
    },
  },
};
