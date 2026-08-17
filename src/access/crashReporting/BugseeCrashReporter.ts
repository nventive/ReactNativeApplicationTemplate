import type { Logger } from '../logger/Logger';
import type { BugseeGateway } from './BugseeGateway';
import { isValidBugseeToken } from './bugseeToken';
import type { CrashReporter } from './CrashReporter';
import { NoopCrashReporter } from './NoopCrashReporter';

/**
 * The Bugsee-backed {@link CrashReporter}. Launches a Bugsee session on
 * construction and forwards errors/events/attributes to the SDK through a
 * {@link BugseeGateway}. It is constructed only when reporting should be active
 * (see {@link resolveCrashReporter}); if the SDK turns out to be absent it
 * degrades to a safe no-op with {@link isEnabled} `false`.
 */
export class BugseeCrashReporter implements CrashReporter {
  readonly isEnabled: boolean;

  constructor(
    private readonly gateway: BugseeGateway,
    token: string,
    private readonly logger: Logger,
  ) {
    this.isEnabled = gateway.isAvailable;
    if (this.isEnabled) {
      gateway.launch(token).catch((error: unknown) => {
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
  if (!isValidBugseeToken(deps.token)) {
    deps.logger.info('Crash reporting: no valid Bugsee token; running the no-op reporter');
    return new NoopCrashReporter(deps.logger);
  }
  return new BugseeCrashReporter(deps.gateway, deps.token, deps.logger);
}
