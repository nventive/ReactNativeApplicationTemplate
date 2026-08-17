import type { BugseeGateway } from './BugseeGateway';

/**
 * The minimal slice of the `react-native-bugsee` API this gateway calls. Typed
 * locally (rather than against the package) so the template typechecks and tests
 * without the optional SDK installed; the real module satisfies this shape once a
 * project adds Bugsee. `logException` is optional — SDK versions differ, so the
 * gateway falls back to an `event` when it is absent.
 */
interface BugseeSdk {
  launch(token: string, options?: Record<string, unknown>): Promise<unknown>;
  event(name: string, params?: Record<string, unknown>): void;
  setAttribute(key: string, value: string | number | boolean): void;
  logException?(error: unknown, handled?: boolean): void;
}

type BugseeModule = { default?: BugseeSdk } & BugseeSdk;

/**
 * Loads the optional Bugsee SDK, or `undefined` when it is not installed. The
 * `require` is a **literal** so Metro bundles the module once a project installs
 * it; the `try/catch` keeps the default template (which ships without the
 * package) from crashing. This file is imported only from the opt-in wiring path.
 */
function loadBugsee(): BugseeSdk | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const moduleExport = require('react-native-bugsee') as BugseeModule;
    return moduleExport.default ?? moduleExport;
  } catch {
    return undefined;
  }
}

/**
 * The real {@link BugseeGateway}, backed by `react-native-bugsee`. This is the
 * **only** file that touches the Bugsee SDK.
 *
 * Bugsee is an **opt-in**, **internal-builds-only** integration (billed per
 * user): the package is not a default dependency, so the SDK is loaded lazily
 * above. When it is absent, {@link isAvailable} is `false` and the
 * composition root uses `NoopCrashReporter`. A project activates Bugsee by
 * installing the package and wiring `createBugseeCrashReporter` — see
 * `doc/CrashReporting.md`.
 */
export class NativeBugseeGateway implements BugseeGateway {
  private readonly sdk = loadBugsee();

  get isAvailable(): boolean {
    return this.sdk !== undefined;
  }

  async launch(token: string): Promise<void> {
    if (!this.sdk) return;
    await this.sdk.launch(token);
  }

  logException(error: unknown, context?: Record<string, unknown>): void {
    if (!this.sdk) return;
    if (typeof this.sdk.logException === 'function') {
      this.sdk.logException(error, true);
      if (context) this.sdk.event('handled_exception_context', context);
      return;
    }
    // Fallback for SDK builds without logException: record as an event.
    this.sdk.event('handled_exception', { message: String(error), ...context });
  }

  event(name: string, properties?: Record<string, unknown>): void {
    this.sdk?.event(name, properties);
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.sdk?.setAttribute(key, value);
  }
}
