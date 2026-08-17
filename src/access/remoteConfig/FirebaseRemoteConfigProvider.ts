import { BehaviorSubject, type Observable } from 'rxjs';

import type { Logger } from '../logger/Logger';
import { formatVersion } from '../version/Version';
import {
  REMOTE_CONFIG_DEFAULTS,
  REMOTE_CONFIG_KEYS,
  toRemoteConfigValues,
  type RemoteConfigValues,
} from './RemoteConfig';
import { FirebaseRemoteConfigGateway } from './FirebaseRemoteConfigGateway';
import type { RemoteConfigGateway } from './RemoteConfigGateway';
import type { RemoteConfigProvider } from './RemoteConfigProvider';

/** Fetch timeout for a single Firebase fetch (one minute). */
const FETCH_TIMEOUT_MILLIS = 60_000;

/**
 * The real {@link RemoteConfigProvider}, backed by Firebase Remote Config through
 * a {@link RemoteConfigGateway}. It is the drop-in replacement for
 * `StaticRemoteConfigProvider` when mocking is off and a project has wired
 * Firebase — the forced-update and kill-switch services consume it unchanged.
 *
 * Behaviour:
 * - seeds the safe {@link REMOTE_CONFIG_DEFAULTS} immediately, so the gates never
 *   block before the first fetch resolves,
 * - applies in-app defaults + fetch settings, then `fetchAndActivate`,
 * - listens for real-time updates and re-reads,
 * - fails **soft**: any SDK error (including the SDK being absent) leaves the
 *   last-known/default values in place and is logged, never thrown.
 *
 * It intentionally does **not** implement `RemoteConfigController` — the mock
 * controls are the diagnostics story; production values come from the console.
 */
export class FirebaseRemoteConfigProvider implements RemoteConfigProvider {
  private readonly _values$: BehaviorSubject<RemoteConfigValues>;
  readonly values$: Observable<RemoteConfigValues>;
  private unsubscribe: (() => void) | undefined;

  constructor(
    private readonly gateway: RemoteConfigGateway,
    private readonly logger: Logger,
    private readonly fetchIntervalMinutes: number,
  ) {
    this._values$ = new BehaviorSubject<RemoteConfigValues>(REMOTE_CONFIG_DEFAULTS);
    this.values$ = this._values$.asObservable();
    void this.initialize();
  }

  getValues(): RemoteConfigValues {
    return this._values$.getValue();
  }

  async refresh(): Promise<void> {
    if (!this.gateway.isAvailable) return;
    try {
      await this.gateway.fetchAndActivate();
      this.readAndEmit();
    } catch (error) {
      this.logger.warn('Remote config refresh failed; keeping last-known values', error);
    }
  }

  /** Removes the real-time listener (call on teardown / hot reload). */
  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private async initialize(): Promise<void> {
    if (!this.gateway.isAvailable) {
      this.logger.info('Firebase Remote Config unavailable; serving safe defaults');
      return;
    }
    try {
      await this.gateway.configure({
        defaults: {
          [REMOTE_CONFIG_KEYS.minimumVersion]: formatVersion(REMOTE_CONFIG_DEFAULTS.minimumVersion),
          [REMOTE_CONFIG_KEYS.killSwitchActive]: REMOTE_CONFIG_DEFAULTS.killSwitchActive,
        },
        minimumFetchIntervalMillis: this.fetchIntervalMinutes * 60_000,
        fetchTimeoutMillis: FETCH_TIMEOUT_MILLIS,
      });
      this.readAndEmit();
      this.unsubscribe = this.gateway.onConfigUpdated(() => this.readAndEmit());
      await this.refresh();
    } catch (error) {
      this.logger.warn('Firebase Remote Config init failed; serving safe defaults', error);
    }
  }

  private readAndEmit(): void {
    const values = toRemoteConfigValues({
      minimum_version: this.gateway.getString(REMOTE_CONFIG_KEYS.minimumVersion),
      is_kill_switch_active: this.gateway.getBoolean(REMOTE_CONFIG_KEYS.killSwitchActive),
    });
    this._values$.next(values);
  }
}

/**
 * Builds the Firebase-backed provider with the real native gateway. This is the
 * **opt-in wiring seam**: importing it pulls in {@link FirebaseRemoteConfigGateway}
 * (and, at build time, the optional Firebase SDK), so it is referenced only from
 * the app entry when Firebase is activated — never from the default composition
 * root (which keeps the base template's bundle SDK-free). Pass it to
 * `createServices({ remoteConfigFactory: createFirebaseRemoteConfigProvider })`.
 */
export function createFirebaseRemoteConfigProvider(deps: {
  logger: Logger;
  fetchIntervalMinutes: number;
}): FirebaseRemoteConfigProvider {
  return new FirebaseRemoteConfigProvider(
    new FirebaseRemoteConfigGateway(),
    deps.logger,
    deps.fetchIntervalMinutes,
  );
}
