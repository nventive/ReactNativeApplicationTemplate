import type { Logger } from '../logger/Logger';
import type { BugseeGateway } from './BugseeGateway';
import { isValidBugseeToken, normalizeBugseeToken } from './bugseeToken';
import type { CrashReporter } from './CrashReporter';
import { NoopCrashReporter } from './NoopCrashReporter';

/**
 * The Bugsee-backed {@link CrashReporter}. Launches a Bugsee session when
 * {@link start} is called and forwards errors/events/attributes to the SDK
 * through a {@link BugseeGateway}. It is constructed only when reporting should be
 * active (see {@link resolveCrashReporter}); if the SDK turns out to be absent it
 * degrades to a safe no-op with {@link isEnabled} `false`.
 *
 * Construction is side-effect-free: the launch (the async I/O) is deferred to
 * {@link start}, invoked once by the composition root's `startServices` step, so
 * construction order never silently becomes I/O order.
 */
export class BugseeCrashReporter implements CrashReporter {
  readonly isEnabled: boolean;
  private launched = false;

  constructor(
    private readonly gateway: BugseeGateway,
    private readonly token: string,
    private readonly logger: Logger,
  ) {
    this.isEnabled = gateway.isAvailable;
  }

  /**
   * Launches the Bugsee session. Idempotent, and a no-op when the SDK is absent
   * ({@link isEnabled} is `false`). Kept off the constructor so wiring stays
   * pure; the `startServices` step calls it once after the graph is built.
   */
  start(): void {
    if (this.launched) return;
    this.launched = true;
    if (this.isEnabled) {
      this.gateway.launch(this.token).catch((error: unknown) => {
        this.logger.warn('Bugsee launch failed; crash reporting inactive this session', error);
      });
    } else {
      this.logger.info('Bugsee SDK not installed; crash reporting is off');
    }
  }

  recordError(error: unknown, context?: Record<string, unknown>): void {
    if (this.isEnabled) this.gateway.logException(error, context);
  }

  recordEvent(name: string, properties?: Record<string, unknown>): void {
    if (this.isEnabled) this.gateway.event(name, properties);
  }

  setAttribute(key: string, value: string | number | boolean): void {
    if (this.isEnabled) this.gateway.setAttribute(key, value);
  }
}

/**
 * The single gate deciding whether crashes are reported — the enforcement point
 * for the two rules that govern crash reporting:
 *
 * 1. **Internal builds only** — `crashReportingEnabled` is `false` in production
 *    (Bugsee is billed per user), so production always gets the no-op reporter.
 * 2. **Valid token required** — a missing/placeholder token (the value the public
 *    repo ships) fails the GUID check and yields the no-op reporter. CI injects a
 *    real token only for internal lanes.
 *
 * Both must hold **and** the SDK must be present for reporting to run. Pure and
 * Tier-1 testable (inject a fake gateway).
 */
export function resolveCrashReporter(deps: {
  crashReportingEnabled: boolean;
  token: string | undefined;
  gateway: BugseeGateway;
  logger: Logger;
}): CrashReporter {
  if (!deps.crashReportingEnabled) {
    // Production / reporting-disabled environment: never launch Bugsee.
    return new NoopCrashReporter(deps.logger);
  }
  // Normalize once at the boundary so validation and launch see the same string.
  const token = normalizeBugseeToken(deps.token);
  if (!isValidBugseeToken(token)) {
    deps.logger.info('Crash reporting: no valid Bugsee token; running the no-op reporter');
    return new NoopCrashReporter(deps.logger);
  }
  return new BugseeCrashReporter(deps.gateway, token, deps.logger);
}
