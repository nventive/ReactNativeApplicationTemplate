import { BehaviorSubject, type Observable } from 'rxjs';

import type { KeyValueStore } from '../../access/storage/KeyValueStore';
import type { DiagnosticsService } from './DiagnosticsService';

/** Storage key under which the permanent-disable choice is persisted. */
export const DIAGNOSTICS_DISABLED_KEY = 'diagnostics.disabled';

/**
 * Plain-TS {@link DiagnosticsService}. Resolves initial availability
 * synchronously from the environment default and the persisted permanent-disable
 * flag (MMKV is synchronous), then tracks session dismissal in memory.
 *
 * `dismissForSession` lowers availability without persisting (returns next
 * launch); `disablePermanently` persists the flag so the overlay stays hidden.
 * Neither can re-enable a production build, whose `defaultEnabled` is `false`.
 */
export class DefaultDiagnosticsService implements DiagnosticsService {
  private readonly _isAvailable$: BehaviorSubject<boolean>;
  readonly isAvailable$: Observable<boolean>;

  constructor(
    private readonly store: KeyValueStore,
    private readonly defaultEnabled: boolean,
  ) {
    const permanentlyDisabled = store.getBoolean(DIAGNOSTICS_DISABLED_KEY) ?? false;
    this._isAvailable$ = new BehaviorSubject<boolean>(defaultEnabled && !permanentlyDisabled);
    this.isAvailable$ = this._isAvailable$.asObservable();
  }

  isAvailable(): boolean {
    return this._isAvailable$.getValue();
  }

  dismissForSession(): void {
    this._isAvailable$.next(false);
  }

  disablePermanently(): void {
    this.store.setBoolean(DIAGNOSTICS_DISABLED_KEY, true);
    this._isAvailable$.next(false);
  }
}
