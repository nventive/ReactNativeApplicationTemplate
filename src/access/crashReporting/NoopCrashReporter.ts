import type { Logger } from '../logger/Logger';
import type { CrashReporter } from './CrashReporter';

/**
 * The default {@link CrashReporter}: reporting is off. It carries no vendor SDK,
 * so **production / store builds** (and internal builds with no valid token)
 * incur no crash-reporting cost — the whole point of gating Bugsee to internal
 * builds (it is billed per user).
 *
 * Errors are still forwarded to the {@link Logger} at `error` level so they are
 * not silently swallowed locally; nothing leaves the device.
 */
export class NoopCrashReporter implements CrashReporter {
  readonly isEnabled = false;

  constructor(private readonly logger?: Logger) {}

  recordError(error: unknown, context?: Record<string, unknown>): void {
    this.logger?.error('Crash reporter (no-op) received an error', error, context);
  }

  recordEvent(): void {
    // No-op: nothing to record without a backend.
  }

  setAttribute(): void {
    // No-op: no report to attribute.
  }
}
