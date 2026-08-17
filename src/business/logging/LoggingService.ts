import type { Observable } from 'rxjs';

/** The effective console/file transport selection the graph is wired from. */
export interface LoggingSettings {
  /** Whether the console (native logs) transport is attached. */
  readonly console: boolean;
  /** Whether the file transport is attached. */
  readonly file: boolean;
}

/**
 * Runtime, per-user control over which log transports are attached: the
 * "Console logging" and "File logging" toggles in the diagnostics overlay.
 *
 * Both toggles are **restart-to-apply** (like the environment and mocking
 * switches): `setConsoleEnabled` / `setFileEnabled` persist immediately and raise
 * `hasPendingChange$`, but the running logger keeps the transports it was built
 * with — the composition root reads the persisted settings once at startup (see
 * `resolveLoggingSettings`). This keeps logging an environment-defaulted concern
 * while letting a tester override it on a device without a rebuild.
 *
 * "Console logging" is the native console sink (Metro / `adb logcat` / Xcode),
 * i.e. the logs you read over USB with the device plugged into a computer.
 */
export interface LoggingService {
  /** Whether console (native) logging will be on after the next launch. */
  readonly console$: Observable<boolean>;
  /** Whether file logging will be on after the next launch. */
  readonly file$: Observable<boolean>;
  /** Whether either toggle differs from what the running graph was built with. */
  readonly hasPendingChange$: Observable<boolean>;

  /** Synchronous snapshot of the console toggle. */
  getConsoleEnabled(): boolean;
  /** Synchronous snapshot of the file toggle. */
  getFileEnabled(): boolean;

  /** Persists the console toggle (applied on restart). */
  setConsoleEnabled(enabled: boolean): void;
  /** Persists the file toggle (applied on restart). */
  setFileEnabled(enabled: boolean): void;
}
