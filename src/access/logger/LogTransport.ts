import type { LogEntry } from './Logger';

/**
 * A log sink. A `Logger` fans an already-level-filtered `LogEntry` out to every
 * registered transport.
 *
 * `write` is synchronous: a transport that does async I/O (the file transport)
 * buffers internally and drains in `flush`. A transport must never throw out of
 * `write` — the `CompositeLogger` guards against it, but logging is best-effort
 * and must never crash the caller.
 */
export interface LogTransport {
  write(entry: LogEntry): void;
  /** Drains any buffered writes (e.g. before sharing/reading the log file). */
  flush?(): Promise<void>;
  /** Releases resources; called on teardown. */
  dispose?(): Promise<void>;
}

/**
 * Formats an entry as a single plain-text line for text transports (console,
 * file). No ANSI color codes are emitted, so there is nothing to strip.
 */
export function formatLogEntry(entry: LogEntry): string {
  const parts = [entry.timestamp.toISOString(), entry.level.toUpperCase().padEnd(5), entry.message];
  if (entry.meta && Object.keys(entry.meta).length > 0) {
    parts.push(safeStringify(entry.meta));
  }
  if (entry.error !== undefined) {
    parts.push(formatError(entry.error));
  }
  return parts.join(' ');
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return safeStringify(error);
}

function safeStringify(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}
