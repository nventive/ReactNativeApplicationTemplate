import { getFirebaseEnabledNatively } from '../config/appEnvironment';
import type { Services } from './createServices';
import {
  checkPlatformIntegrationConsistency,
  isFirebaseRemoteConfigAvailable,
} from './platformIntegrations';

/**
 * A service with an explicit, owner-invoked launch step. Only the opt-in vendor
 * implementations have one — `BugseeCrashReporter` (launches the session) and
 * `FirebaseRemoteConfigProvider` (configures + fetches + listens). The default
 * no-op / mock / static implementations do not, so {@link isStartable} skips them.
 */
interface Startable {
  start(): void | Promise<void>;
}

function isStartable(value: unknown): value is Startable {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<Startable>).start === 'function'
  );
}

/**
 * The explicit **start** step, run once by the app entry after the graph is
 * built. It owns every runtime side effect that used to happen mid-wiring or in a
 * constructor, so `createServices` stays a pure construction pass and construction
 * order never silently becomes I/O order once vendor SDKs are active. It:
 *
 * - warns when the Firebase native footprint and JS SDK wiring disagree,
 * - launches the opt-in integrations that are startable (Bugsee, Firebase) — a
 *   no-op for the default no-op/mock/static implementations,
 * - tags crash reports with the active environment.
 *
 * Idempotent per graph: the startable services guard against a double launch, so
 * a second call is harmless (though the app entry calls it exactly once).
 */
export function startServices(services: Services): void {
  // Coordinate the two Firebase switches from one place: a native footprint with
  // no JS SDK (or vice versa) is a misconfiguration that would otherwise fail
  // silently. Uses SDK availability — not the resolved provider — so a dev build
  // with mocking on (which serves the mock provider by design) never false-alarms.
  checkPlatformIntegrationConsistency({
    firebaseEnabledNatively: getFirebaseEnabledNatively(),
    firebaseSdkAvailable: isFirebaseRemoteConfigAvailable(),
    logger: services.logger,
  });

  // Launch the opt-in integrations, then attribute the reporter — mirroring the
  // previous ordering (the reporter was launched before `setAttribute` ran). Both
  // starts are fire-and-forget: the Firebase provider seeds safe defaults
  // synchronously, so the operational gates never block on this step.
  if (isStartable(services.crashReporter)) void services.crashReporter.start();
  services.crashReporter.setAttribute('environment', services.environment.getCurrent());
  if (isStartable(services.remoteConfig)) void services.remoteConfig.start();
}
