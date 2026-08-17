/**
 * The crash & session reporting seam — the single Access surface handled errors,
 * domain breadcrumbs, and report attributes flow through, never a vendor SDK
 * directly. It is the same seam pattern as {@link AnalyticsSink}: the template
 * ships Bugsee for **internal builds only**, and a project drops in its own
 * production crash reporter (typically Firebase Crashlytics — out of template
 * scope) at one boundary, without threading an SDK through the app.
 *
 * Implementations:
 * - `NoopCrashReporter` — the default; does nothing (the production / no-token
 *   path), so store builds carry no reporting SDK cost.
 * - `BugseeCrashReporter` — wraps the Bugsee SDK; active only on internal builds
 *   with a valid token (see `doc/CrashReporting.md`).
 * - `RecordingCrashReporter` — records calls for Tier-1 assertions.
 */
export interface CrashReporter {
  /**
   * Whether reporting is actually running. `false` for the no-op path (production
   * builds, or internal builds with no/invalid token). The diagnostics overlay
   * reads this to explain why reporting is or isn't active.
   */
  readonly isEnabled: boolean;

  /**
   * Reports a handled or unhandled error. Wired into the app-shell error boundary
   * and available to any Business/Presentation unit that catches a recoverable
   * error.
   */
  recordError(error: unknown, context?: Record<string, unknown>): void;

  /** Records a domain breadcrumb attached to the session (Bugsee `event`). */
  recordEvent(name: string, properties?: Record<string, unknown>): void;

  /** Attaches an attribute to subsequent reports (Bugsee `setAttribute`). */
  setAttribute(key: string, value: string | number | boolean): void;
}
