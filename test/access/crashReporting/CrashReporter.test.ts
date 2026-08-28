/**
 * Tier 1 — the crash-reporting seam. The focus is the gate
 * ({@link resolveCrashReporter}) that enforces the two template rules: reporting
 * is **off in production** (billed per user) and requires a **valid token**, plus
 * the no-op / recording doubles.
 */
import {
  BugseeCrashReporter,
  resolveCrashReporter,
} from '../../../src/access/crashReporting/BugseeCrashReporter';
import type { BugseeGateway } from '../../../src/access/crashReporting/BugseeGateway';
import type { CrashReporter } from '../../../src/access/crashReporting/CrashReporter';
import { isValidBugseeToken } from '../../../src/access/crashReporting/bugseeToken';
import { NoopCrashReporter } from '../../../src/access/crashReporting/NoopCrashReporter';
import { RecordingCrashReporter } from '../../../src/access/crashReporting/RecordingCrashReporter';
import { MockLogger } from '../../../src/access/logger/MockLogger';

const VALID_TOKEN = '12345678-1234-1234-1234-123456789abc';

/** In-memory {@link BugseeGateway} capturing launch + calls. */
class FakeBugseeGateway implements BugseeGateway {
  launchedToken: string | undefined;
  readonly exceptions: unknown[] = [];
  readonly events: string[] = [];

  constructor(readonly isAvailable: boolean = true) {}

  launch(token: string): Promise<void> {
    this.launchedToken = token;
    return Promise.resolve();
  }

  logException(error: unknown): void {
    this.exceptions.push(error);
  }

  event(name: string): void {
    this.events.push(name);
  }

  setAttribute(): void {}
}

describe('isValidBugseeToken', () => {
  it('accepts a GUID and rejects anything else', () => {
    expect(isValidBugseeToken(VALID_TOKEN)).toBe(true);
    expect(isValidBugseeToken(undefined)).toBe(false);
    expect(isValidBugseeToken('')).toBe(false);
    expect(isValidBugseeToken('<token>')).toBe(false);
    expect(isValidBugseeToken('not-a-guid')).toBe(false);
  });
});

describe('resolveCrashReporter (the gate)', () => {
  it('is a no-op in production, even with a valid token and available SDK', () => {
    const gateway = new FakeBugseeGateway(true);
    const reporter = resolveCrashReporter({
      crashReportingEnabled: false, // production
      token: VALID_TOKEN,
      gateway,
      logger: new MockLogger(),
    });

    expect(reporter).toBeInstanceOf(NoopCrashReporter);
    expect(reporter.isEnabled).toBe(false);
    expect(gateway.launchedToken).toBeUndefined(); // never launched
  });

  it('is a no-op on an internal build with no / invalid token', () => {
    const logger = new MockLogger();
    const noToken = resolveCrashReporter({
      crashReportingEnabled: true,
      token: undefined,
      gateway: new FakeBugseeGateway(true),
      logger,
    });
    const badToken = resolveCrashReporter({
      crashReportingEnabled: true,
      token: 'placeholder',
      gateway: new FakeBugseeGateway(true),
      logger,
    });

    expect(noToken.isEnabled).toBe(false);
    expect(badToken.isEnabled).toBe(false);
    expect(noToken).toBeInstanceOf(NoopCrashReporter);
    expect(badToken).toBeInstanceOf(NoopCrashReporter);
  });

  it('launches Bugsee on an internal build with a valid token and reports errors', () => {
    const gateway = new FakeBugseeGateway(true);
    const reporter = resolveCrashReporter({
      crashReportingEnabled: true,
      token: VALID_TOKEN,
      gateway,
      logger: new MockLogger(),
    });

    expect(reporter).toBeInstanceOf(BugseeCrashReporter);
    expect(reporter.isEnabled).toBe(true);
    expect(gateway.launchedToken).toBe(VALID_TOKEN);

    const error = new Error('boom');
    reporter.recordError(error);
    expect(gateway.exceptions).toContain(error);
  });

  it('launches with the trimmed token when the injected value has stray whitespace', () => {
    const gateway = new FakeBugseeGateway(true);
    const reporter = resolveCrashReporter({
      crashReportingEnabled: true,
      token: `  ${VALID_TOKEN}\n`,
      gateway,
      logger: new MockLogger(),
    });

    expect(reporter.isEnabled).toBe(true);
    expect(gateway.launchedToken).toBe(VALID_TOKEN); // trimmed, not the raw value
  });

  it('degrades to a disabled reporter when the SDK is absent', () => {
    const gateway = new FakeBugseeGateway(false); // package not installed
    const reporter = resolveCrashReporter({
      crashReportingEnabled: true,
      token: VALID_TOKEN,
      gateway,
      logger: new MockLogger(),
    });

    expect(reporter.isEnabled).toBe(false);
    expect(gateway.launchedToken).toBeUndefined();
    reporter.recordError(new Error('ignored')); // must not throw
    expect(gateway.exceptions).toHaveLength(0);
  });
});

describe('NoopCrashReporter', () => {
  it('is disabled, forwards errors to the logger, and ignores events/attributes', () => {
    const logger = new MockLogger();
    const reporter: CrashReporter = new NoopCrashReporter(logger);

    expect(reporter.isEnabled).toBe(false);
    reporter.recordError(new Error('local only'), { where: 'test' });
    reporter.recordEvent('ignored');
    reporter.setAttribute('k', 'v');

    expect(logger.entriesOf('error')).toHaveLength(1);
  });
});

describe('RecordingCrashReporter', () => {
  it('records errors, events, and attributes for assertions', () => {
    const reporter = new RecordingCrashReporter();

    reporter.recordError(new Error('x'));
    reporter.recordEvent('favorited', { id: '1' });
    reporter.setAttribute('env', 'development');

    expect(reporter.recordsOf('error')).toHaveLength(1);
    expect(reporter.recordsOf('event')[0].name).toBe('favorited');
    expect(reporter.recordsOf('attribute')[0].value).toBe('development');
  });
});
