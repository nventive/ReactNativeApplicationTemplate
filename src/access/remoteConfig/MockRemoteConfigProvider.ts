import { BehaviorSubject, type Observable } from 'rxjs';

import type { Version } from '../version/Version';
import { REMOTE_CONFIG_DEFAULTS, type RemoteConfigValues } from './RemoteConfig';
import type { RemoteConfigController, RemoteConfigProvider } from './RemoteConfigProvider';

/**
 * Controllable in-memory {@link RemoteConfigProvider}. Seeds the safe defaults
 * (`1.0.0` / kill switch off) and lets the diagnostics overlay push new values
 * at runtime.
 *
 * It is the provider selected whenever mocking is active (dev by default, or via
 * the runtime mocking toggle), so the app's remote-driven features are fully
 * exercisable with no Firebase project. `refresh()` is a no-op.
 */
export class MockRemoteConfigProvider implements RemoteConfigProvider, RemoteConfigController {
  private readonly _values$: BehaviorSubject<RemoteConfigValues>;
  readonly values$: Observable<RemoteConfigValues>;

  constructor(initial: RemoteConfigValues = REMOTE_CONFIG_DEFAULTS) {
    this._values$ = new BehaviorSubject<RemoteConfigValues>(initial);
    this.values$ = this._values$.asObservable();
  }

  getValues(): RemoteConfigValues {
    return this._values$.getValue();
  }

  refresh(): Promise<void> {
    return Promise.resolve();
  }

  setMinimumVersion(minimumVersion: Version): void {
    this._values$.next({ ...this._values$.getValue(), minimumVersion });
  }

  setKillSwitchActive(active: boolean): void {
    this._values$.next({ ...this._values$.getValue(), killSwitchActive: active });
  }

  toggleKillSwitch(): void {
    this.setKillSwitchActive(!this._values$.getValue().killSwitchActive);
  }
}
