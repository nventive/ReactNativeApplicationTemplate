import type { CrashReporter } from '../../access/crashReporting/CrashReporter';
import { getBugseeToken } from '../../access/crashReporting/bugseeToken';
import { resolveCrashReporter } from '../../access/crashReporting/BugseeCrashReporter';
import { NativeBugseeGateway } from '../../access/crashReporting/NativeBugseeGateway';
import type { Logger } from '../../access/logger/Logger';
import { createFirebaseRemoteConfigProvider } from '../../access/remoteConfig/FirebaseRemoteConfigProvider';
import type { RemoteConfigProvider } from '../../access/remoteConfig/RemoteConfigProvider';
import type { EnvironmentConfig } from '../../business/environment/EnvironmentService';
import type { ServiceOverrides } from './createServices';

/**
 * The **opt-in platform-integration wiring** for Firebase Remote Config and
 * Bugsee crash reporting.
 *
 * This is the single module that imports the native gateways, so importing it
 * pulls the optional vendor SDKs into the bundle. The **default** app entry does
 * **not** import it — `createServices()` alone yields the SDK-free template
 * (`StaticRemoteConfigProvider` + `NoopCrashReporter`), which keeps the public
 * repo's bundle and native build free of Firebase/Bugsee. A project activates the
 * integrations by installing the packages and passing
 * {@link platformIntegrationOverrides} to `createServices` — see
 * `doc/FirebaseRemoteConfig.md` and `doc/CrashReporting.md`.
 *
 * The factories receive the composition root's already-resolved `logger` and env
 * `config`, so environment rules (fetch interval, "reporting off in production")
 * are honoured without re-reading anything.
 */

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
 * The overrides that activate both platform integrations. Spread into
 * `createServices` from the app entry once the SDKs are installed:
 *
 * ```ts
 * const services = createServices(platformIntegrationOverrides());
 * ```
 */
export function platformIntegrationOverrides(): ServiceOverrides {
  return {
    remoteConfigFactory: firebaseRemoteConfigFactory,
    crashReporterFactory: bugseeCrashReporterFactory,
  };
}
