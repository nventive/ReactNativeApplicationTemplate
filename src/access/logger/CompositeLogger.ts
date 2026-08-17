import { shouldLog } from './LevelFilter';
import type { Logger, LogEntry, LogMeta } from './Logger';
import type { LogLevel } from './LogLevel';
import type { LogTransport } from './LogTransport';

export interface CompositeLoggerOptions {
  readonly transports: readonly LogTransport[];
  readonly minimumLevel: LogLevel;
}

/**
 * The app `Logger`: applies the level filter once, then fans each entry out to
 * every transport.
 *
 * A below-threshold call returns before an entry is even constructed, so
 * disabled levels are cheap. A throwing transport can never crash the caller —
 * `write` is guarded — because logging is best-effort.
 */
export class CompositeLogger implements Logger {
  private readonly transports: readonly LogTransport[];
  private readonly minimumLevel: LogLevel;

  constructor(options: CompositeLoggerOptions) {
    this.transports = options.transports;
    this.minimumLevel = options.minimumLevel;
  }

  trace(message: string, meta?: LogMeta): void {
    this.emit('trace', message, undefined, meta);
  }

  debug(message: string, meta?: LogMeta): void {
    this.emit('debug', message, undefined, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.emit('info', message, undefined, meta);
  }

  warn(message: string, error?: unknown, meta?: LogMeta): void {
    this.emit('warn', message, error, meta);
  }

  error(message: string, error?: unknown, meta?: LogMeta): void {
    this.emit('error', message, error, meta);
  }

  fatal(message: string, error?: unknown, meta?: LogMeta): void {
    this.emit('fatal', message, error, meta);
  }

  private emit(level: LogLevel, message: string, error?: unknown, meta?: LogMeta): void {
    if (!shouldLog(level, this.minimumLevel)) {
      return;
    }
    const entry: LogEntry = { level, message, timestamp: new Date(), error, meta };
    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch {
        // A misbehaving transport must not take down the app.
      }
    }
  }
}
