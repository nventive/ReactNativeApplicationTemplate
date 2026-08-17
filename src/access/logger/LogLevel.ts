/**
 * The six semantic log levels (`trace → debug → info → warning → error →
 * fatal`). `warn` is spelled the JS-idiomatic way (matching `console.warn`);
 * everything else keeps the conventional names.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Numeric rank used to order levels. A level is emitted when its rank is at or
 * above the configured minimum (see `LevelFilter`).
 */
export const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/**
 * Parses a level from configuration (e.g. the environment's `minimumLevel`),
 * tolerating the `'warning'` spelling. Falls back to `'debug'` for an unknown
 * value — the safe default (log more, not less).
 */
export function parseLogLevel(value: string | undefined): LogLevel {
  switch (value?.toLowerCase()) {
    case 'trace':
      return 'trace';
    case 'debug':
      return 'debug';
    case 'info':
      return 'info';
    case 'warn':
    case 'warning':
      return 'warn';
    case 'error':
      return 'error';
    case 'fatal':
      return 'fatal';
    default:
      return 'debug';
  }
}
