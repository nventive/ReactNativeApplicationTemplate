import { BehaviorSubject, type Observable } from 'rxjs';

import { REMOTE_CONFIG_DEFAULTS, type RemoteConfigValues } from './RemoteConfig';
import type { RemoteConfigProvider } from './RemoteConfigProvider';

/**
 * A {@link RemoteConfigProvider} that only ever serves the safe defaults — no
 * backend, no controls. It is the provider used when mocking is off and Firebase
 * is not wired (the default public template): the app keeps running, and the
 * operational features stay dormant (minimum `1.0.0`, kill switch off).
 *
 * When a project opts into Firebase, `FirebaseRemoteConfigProvider`
 * replaces this on the non-mock path; the diagnostics mock controls always come
 * from {@link MockRemoteConfigProvider}. See `doc/FirebaseRemoteConfig.md`.
 */
export class StaticRemoteConfigProvider implements RemoteConfigProvider {
  private readonly _values$: BehaviorSubject<RemoteConfigValues>;
  readonly values$: Observable<RemoteConfigValues>;

  constructor(values: RemoteConfigValues = REMOTE_CONFIG_DEFAULTS) {
    this._values$ = new BehaviorSubject<RemoteConfigValues>(values);
    this.values$ = this._values$.asObservable();
  }

  getValues(): RemoteConfigValues {
    return this._values$.getValue();
  }

  refresh(): Promise<void> {
    return Promise.resolve();
  }
}
