import type { Logger, LogEntry, LogMeta } from './Logger';

/**
 * In-memory `Logger` that records every entry, for Tier-1 assertions ("this
 * service logged a warning with the mapped error"). It applies no level filter
 * — everything is captured.
 */
export class MockLogger implements Logger {
  readonly entries: LogEntry[] = [];

  trace(message: string, meta?: LogMeta): void {
    this.record('trace', message, undefined, meta);
  }

  debug(message: string, meta?: LogMeta): void {
    this.record('debug', message, undefined, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.record('info', message, undefined, meta);
  }

  warn(message: string, error?: unknown, meta?: LogMeta): void {
    this.record('warn', message, error, meta);
  }

  error(message: string, error?: unknown, meta?: LogMeta): void {
    this.record('error', message, error, meta);
  }

  fatal(message: string, error?: unknown, meta?: LogMeta): void {
    this.record('fatal', message, error, meta);
  }

  /** All recorded entries at the given level. */
  entriesOf(level: LogEntry['level']): LogEntry[] {
    return this.entries.filter((entry) => entry.level === level);
  }

  private record(
    level: LogEntry['level'],
    message: string,
    error: unknown,
    meta: LogMeta | undefined,
  ): void {
    this.entries.push({ level, message, timestamp: new Date(), error, meta });
  }
}
