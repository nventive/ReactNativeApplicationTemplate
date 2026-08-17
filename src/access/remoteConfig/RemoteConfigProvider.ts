import type { Observable } from 'rxjs';

import type { Version } from '../version/Version';
import type { RemoteConfigValues } from './RemoteConfig';

/**
 * Read access to remote configuration — the single Access surface forced update
 * and the kill switch build on. One provider exposes the whole
 * {@link RemoteConfigValues} snapshot (both the minimum version and the kill
 * switch flag).
 *
 * Values are exposed as a `BehaviorSubject`-backed `Observable` so the business
 * services react to remote changes as they happen. The real
 * `@react-native-firebase/remote-config` implementation is
 * `FirebaseRemoteConfigProvider`; the operational features build entirely
 * against this interface (mocking principle — the app runs with no backend).
 */
export interface RemoteConfigProvider {
  /** The live config; emits the current snapshot immediately and on every change. */
  readonly values$: Observable<RemoteConfigValues>;

  /** Synchronous snapshot of the current values. */
  getValues(): RemoteConfigValues;

  /**
   * Fetches and activates the latest remote values (maps to Firebase's
   * `fetchAndActivate`). A no-op for providers with no backend (the mock).
   * Best-effort: failures leave the last-known/default values in place.
   */
  refresh(): Promise<void>;
}

/**
 * The control surface a **mockable** provider adds on top of
 * {@link RemoteConfigProvider}, so the diagnostics overlay can drive the
 * operational features without a backend.
 *
 * Only the mock implements this; the composition root exposes it as
 * `remoteConfigController` only when mocking is active (so the trigger buttons
 * appear only when they would actually do something).
 */
export interface RemoteConfigController {
  /** Pushes a new minimum version (used to force the update gate in diagnostics). */
  setMinimumVersion(minimumVersion: Version): void;
  /** Sets the kill-switch flag. */
  setKillSwitchActive(active: boolean): void;
  /** Flips the current kill-switch flag. */
  toggleKillSwitch(): void;
}

/** Whether a provider also exposes the mock {@link RemoteConfigController} surface. */
export function isRemoteConfigController(
  provider: RemoteConfigProvider,
): provider is RemoteConfigProvider & RemoteConfigController {
  return typeof (provider as Partial<RemoteConfigController>).toggleKillSwitch === 'function';
}
