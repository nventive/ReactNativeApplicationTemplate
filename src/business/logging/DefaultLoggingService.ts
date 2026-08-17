import { BehaviorSubject, combineLatest, map, type Observable } from 'rxjs';

import type { KeyValueStore } from '../../access/storage/KeyValueStore';
import type { EnvironmentConfig } from '../environment/EnvironmentService';
import type { LoggingService, LoggingSettings } from './LoggingService';

/** Storage keys under which the console/file logging overrides are persisted. */
export const LOGGING_CONSOLE_KEY = 'logging.console.enabled';
export const LOGGING_FILE_KEY = 'logging.file.enabled';

/**
 * Resolves the effective logging settings the composition root wires the logger
 * from: the persisted override for each transport if the user has ever set one,
 * otherwise the active environment's default (`config.logging.console` / `.file`).
 *
 * Called once at startup in `createServices`; the result is both the transport
 * selection `buildLogger` uses and the `startupValue` the
 * {@link DefaultLoggingService} compares against for its restart-to-apply banner.
 */
export function resolveLoggingSettings(
  store: KeyValueStore,
  config: EnvironmentConfig,
): LoggingSettings {
  return {
    console: store.getBoolean(LOGGING_CONSOLE_KEY) ?? config.logging.console,
    file: store.getBoolean(LOGGING_FILE_KEY) ?? config.logging.file,
  };
}

/**
 * Plain-TS {@link LoggingService}. Persists each toggle immediately but never
 * re-wires the running logger — `hasPendingChange$` turns `true` as soon as
 * either toggle differs from the `startupValue` the graph was built with, and the
 * diagnostics overlay shows the "restart to apply" banner from it.
 */
export class DefaultLoggingService implements LoggingService {
  private readonly _console$: BehaviorSubject<boolean>;
  private readonly _file$: BehaviorSubject<boolean>;

  readonly console$: Observable<boolean>;
  readonly file$: Observable<boolean>;
  readonly hasPendingChange$: Observable<boolean>;

  constructor(
    private readonly store: KeyValueStore,
    private readonly startupValue: LoggingSettings,
  ) {
    this._console$ = new BehaviorSubject<boolean>(startupValue.console);
    this._file$ = new BehaviorSubject<boolean>(startupValue.file);
    this.console$ = this._console$.asObservable();
    this.file$ = this._file$.asObservable();
    this.hasPendingChange$ = combineLatest([this._console$, this._file$]).pipe(
      map(([console, file]) => console !== startupValue.console || file !== startupValue.file),
    );
  }

  getConsoleEnabled(): boolean {
    return this._console$.getValue();
  }

  getFileEnabled(): boolean {
    return this._file$.getValue();
  }

  setConsoleEnabled(enabled: boolean): void {
    this.store.setBoolean(LOGGING_CONSOLE_KEY, enabled);
    this._console$.next(enabled);
  }

  setFileEnabled(enabled: boolean): void {
    this.store.setBoolean(LOGGING_FILE_KEY, enabled);
    this._file$.next(enabled);
  }
}
