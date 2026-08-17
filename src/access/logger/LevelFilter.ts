import { LOG_LEVEL_RANK, type LogLevel } from './LogLevel';

/**
 * Whether an entry at `level` should be emitted given the configured `minimum`.
 * Filtering happens once in the `Logger`, before fan-out to transports.
 */
export function shouldLog(level: LogLevel, minimum: LogLevel): boolean {
  return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[minimum];
}
