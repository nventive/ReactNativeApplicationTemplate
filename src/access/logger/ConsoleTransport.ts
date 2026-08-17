import { formatLogEntry, type LogTransport } from './LogTransport';
import type { LogEntry } from './Logger';

/**
 * Writes log entries to the platform console (Metro / logcat / Xcode).
 *
 * This is the **one** place in app code allowed to call `console.*`; everywhere
 * else logs go through the injected `Logger`. Levels map onto the console
 * methods so RN devtools colorize/filter them correctly.
 */
export class ConsoleTransport implements LogTransport {
  write(entry: LogEntry): void {
    const line = formatLogEntry(entry);
    switch (entry.level) {
      case 'trace':
      case 'debug':
        console.debug(line);
        break;
      case 'info':
        console.info(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      case 'error':
      case 'fatal':
        console.error(line);
        break;
    }
  }
}
