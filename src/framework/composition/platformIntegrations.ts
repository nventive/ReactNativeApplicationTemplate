import type { CrashReporter } from '../../access/crashReporting/CrashReporter';
import { getBugseeToken } from '../../access/crashReporting/bugseeToken';
import { resolveCrashReporter } from '../../access/crashReporting/BugseeCrashReporter';
import { NativeBugseeGateway } from '../../access/crashReporting/NativeBugseeGateway';
import { LOG_CATEGORY_KEY } from '../../access/logger/LogCategory';
import type { Logger } from '../../access/logger/Logger';
import { createFirebaseRemoteConfigProvider } from '../../access/remoteConfig/FirebaseRemoteConfigProvider';
import { FirebaseRemoteConfigGateway } from '../../access/remoteConfig/FirebaseRemoteConfigGateway';
import type { RemoteConfigProvider } from '../../access/remoteConfig/RemoteConfigProvider';
import type { EnvironmentConfig } from '../../business/environment/EnvironmentService';
import type { ServiceOverrides } from './createServices';

/**
 * The **opt-in platform-integration wiring** for Firebase Remote Config and
 * Bugsee crash reporting.
 *
 * This is the single module that imports the native gateways. Importing it is
 * safe — each gateway defers its optional SDK to a **guarded `require`** run only
 * on construction, so nothing loads until an SDK is actually installed. The app
 * entry always spreads {@link platformIntegrationOverrides} into `createServices`;
 * in the default template neither SDK is present, so it returns `{}` and the graph
 * is exactly the SDK-free one (`StaticRemoteConfigProvider` + `NoopCrashReporter`).
 * Installing an SDK lights up its factory automatically — see
 * `doc/FirebaseRemoteConfig.md` and `doc/CrashReporting.md`.
 *
 * The factories receive the composition root's already-resolved `logger` and env
 * `config`, so environment rules (fetch interval, "reporting off in production")
 * are honoured without re-reading anything.
 */

/** Log category for platform-integration wiring diagnostics. */
const LOG_CATEGORY = 'platformIntegration';

/** Builds the Firebase-backed remote-config provider from resolved deps. */
export function firebaseRemoteConfigFactory(deps: {
  logger: Logger;
  config: EnvironmentConfig;
}): RemoteConfigProvider {
  return createFirebaseRemoteConfigProvider({
    logger: deps.logger,
    fetchIntervalMinutes: deps.config.remoteConfig.fetchIntervalMinutes,
  });
}

/** Builds the crash reporter (Bugsee on internal builds, else no-op) from resolved deps. */
export function bugseeCrashReporterFactory(deps: {
  logger: Logger;
  config: EnvironmentConfig;
}): CrashReporter {
  return resolveCrashReporter({
    crashReportingEnabled: deps.config.crashReportingEnabled,
    token: getBugseeToken(),
    gateway: new NativeBugseeGateway(),
    logger: deps.logger,
  });
}

/**
 * Whether the Firebase Remote Config **JS SDK** is installed (its guarded
 * `require` resolves). This is the JS-side half of the Firebase switch; the
 * native half is the `FIREBASE_ENABLED` build flag
 * (`getFirebaseEnabledNatively`). `false` in the default template and in tests.
 */
export function isFirebaseRemoteConfigAvailable(): boolean {
  return new FirebaseRemoteConfigGateway().isAvailable;
}

/** Whether the Bugsee **JS SDK** is installed (its guarded `require` resolves). */
export function isBugseeAvailable(): boolean {
  return new NativeBugseeGateway().isAvailable;
}

/**
 * The overrides that activate each platform integration whose SDK is installed.
 * The app entry always spreads this into `createServices`; it is **empty** in the
 * default template (neither optional SDK present), so
 * `createServices(platformIntegrationOverrides())` is identical to
 * `createServices()` there. Installing an SDK lights up its factory:
 *
 * ```ts
 * const services = createServices(platformIntegrationOverrides());
 * ```
 */
export function platformIntegrationOverrides(): ServiceOverrides {
  const overrides: ServiceOverrides = {};
  if (isFirebaseRemoteConfigAvailable()) {
    overrides.remoteConfigFactory = firebaseRemoteConfigFactory;
  }
  if (isBugseeAvailable()) {
    overrides.crashReporterFactory = bugseeCrashReporterFactory;
  }
  return overrides;
}

/**
 * Warns when the Firebase **native** footprint (the `FIREBASE_ENABLED` build
 * flag) and the **JS** SDK wiring disagree — the two switches that used to drift
 * silently. Either half without the other is a misconfiguration:
 *
 * - **native, no JS** — the build carries the Firebase config plugin + config
 *   files, but the JS SDK is not installed, so remote config silently serves
 *   `StaticRemoteConfigProvider`'s defaults instead of console values.
 * - **JS, no native** — the JS SDK is wired, but there is no native Firebase app,
 *   so every fetch fails (the provider fails soft to defaults, but the intended
 *   backend is dead).
 *
 * Pure and Tier-1 testable — the caller (`startServices`) supplies the resolved
 * booleans and a logger. Aligned states (both on, both off) log nothing.
 */
export function checkPlatformIntegrationConsistency(deps: {
  firebaseEnabledNatively: boolean;
  firebaseSdkAvailable: boolean;
  logger: Logger;
}): void {
  const meta = { [LOG_CATEGORY_KEY]: LOG_CATEGORY };
  if (deps.firebaseEnabledNatively && !deps.firebaseSdkAvailable) {
    deps.logger.error(
      'Firebase is enabled natively (FIREBASE_ENABLED=true) but the Firebase Remote Config ' +
        'JS SDK is not installed; remote config will serve static defaults. Install ' +
        '@react-native-firebase/remote-config, or unset FIREBASE_ENABLED.',
      undefined,
      meta,
    );
  } else if (!deps.firebaseEnabledNatively && deps.firebaseSdkAvailable) {
    deps.logger.error(
      'The Firebase Remote Config JS SDK is installed but Firebase is not enabled natively ' +
        '(FIREBASE_ENABLED is unset); there is no native Firebase app, so every fetch will fail. ' +
        'Prebuild with FIREBASE_ENABLED=true and add the native config files, or remove the SDK.',
      undefined,
      meta,
    );
  }
}
