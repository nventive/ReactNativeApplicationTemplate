import { BehaviorSubject, type Observable } from 'rxjs';

import type { KeyValueStore } from '../../access/storage/KeyValueStore';
import type { Environment } from '../environment/EnvironmentService';
import type { MockingService } from './MockingService';

/** Storage key under which the mocking flag is persisted. */
export const MOCKING_ENABLED_KEY = 'mocking.enabled';

/**
 * Resolves the effective mocking flag the composition root wires the graph from:
 * the persisted override if the user has ever set one, otherwise the default for
 * the active environment (**mocks in development, real elsewhere**).
 *
 * Called once at startup in `createServices`; the resulting value is also the
 * `startupValue` the {@link DefaultMockingService} compares against for its
 * restart-to-apply banner.
 */
export function resolveMockingEnabled(store: KeyValueStore, environment: Environment): boolean {
  return store.getBoolean(MOCKING_ENABLED_KEY) ?? environment === 'development';
}

/**
 * Plain-TS {@link MockingService}. Persists the flag immediately on change but
 * never re-wires the running graph — `hasPendingChange$` turns `true` as soon as
 * the toggle differs from the `startupValue` the graph was built with, and the
 * diagnostics overlay shows the "restart to apply" banner from it.
 */
export class DefaultMockingService implements MockingService {
  private readonly _isEnabled$: BehaviorSubject<boolean>;
  private readonly _hasPendingChange$ = new BehaviorSubject<boolean>(false);

  readonly isEnabled$: Observable<boolean>;
  readonly hasPendingChange$: Observable<boolean>;

  constructor(
    private readonly store: KeyValueStore,
    private readonly startupValue: boolean,
  ) {
    this._isEnabled$ = new BehaviorSubject<boolean>(startupValue);
    this.isEnabled$ = this._isEnabled$.asObservable();
    this.hasPendingChange$ = this._hasPendingChange$.asObservable();
  }

  isEnabled(): boolean {
    return this._isEnabled$.getValue();
  }

  setEnabled(enabled: boolean): void {
    this.store.setBoolean(MOCKING_ENABLED_KEY, enabled);
    this._isEnabled$.next(enabled);
    this._hasPendingChange$.next(enabled !== this.startupValue);
  }

  toggle(): void {
    this.setEnabled(!this.isEnabled());
  }
}
