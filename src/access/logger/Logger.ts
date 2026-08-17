import type { Observable } from 'rxjs';

import type { LogLevel } from './LogLevel';

/** Arbitrary structured context attached to a log entry. */
export type LogMeta = Record<string, unknown>;

/** A single log record, produced by a `Logger` and consumed by transports. */
export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: Date;
  /** Optional cause for `warn`/`error`/`fatal`. */
  readonly error?: unknown;
  /** Optional structured context. */
  readonly meta?: LogMeta;
}

/**
 * The logging surface injected everywhere logging is needed — there is no
 * global `console.log` in app code (the console is one transport behind this
 * interface). There is one method per level.
 *
 * Implementations: `CompositeLogger` (level filter + fan-out to transports) for
 * the app, and `MockLogger` (records entries) for Tier-1 tests. Services take a
 * `Logger` by constructor injection.
 */
export interface Logger {
  trace(message: string, meta?: LogMeta): void;
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, error?: unknown, meta?: LogMeta): void;
  error(message: string, error?: unknown, meta?: LogMeta): void;
  fatal(message: string, error?: unknown, meta?: LogMeta): void;
}

/**
 * The retrieval surface a file-backed transport exposes so the diagnostics log
 * viewer / share action can read and export logs without knowing about
 * expo-file-system. `FileTransport` implements this alongside `LogTransport`.
 */
export interface LogFileReader {
  /** Whether the log file currently exists. */
  exists(): Promise<boolean>;
  /** The full log text (flushes any buffered entries first). */
  read(): Promise<string>;
  /** A `file://` URI for the log file, suitable for expo-sharing. */
  getUri(): string;
  /** Deletes the log file. */
  clear(): Promise<void>;
}

/**
 * The retrieval surface an in-memory transport exposes so the in-app log console
 * can render recent entries live, without exporting a file. `InMemoryLogTransport`
 * implements this alongside `LogTransport`.
 *
 * Live state is a `BehaviorSubject` behind this interface, consumed in the UI
 * through `useObservable` (the same MVVM bridge every other live-state service
 * uses); the console never subscribes to RxJS directly.
 */
export interface LogBufferReader {
  /** The recent entries (oldest → newest), as a live observable. */
  readonly entries$: Observable<readonly LogEntry[]>;
  /** Synchronous snapshot of the recent entries. */
  getEntries(): readonly LogEntry[];
  /** Drops every buffered entry. */
  clear(): void;
}
