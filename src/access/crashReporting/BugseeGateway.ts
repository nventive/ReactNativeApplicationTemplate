/**
 * The narrow surface of the native Bugsee SDK the template uses. Wrapping the SDK
 * behind this interface keeps {@link BugseeCrashReporter} Tier-1 testable (drive
 * it with a fake gateway) and confines the one SDK import to
 * {@link NativeBugseeGateway}.
 */
export interface BugseeGateway {
  /**
   * Whether the native Bugsee module is present. `false` when the optional
   * `react-native-bugsee` package is not installed (the default template ships
   * without it).
   */
  readonly isAvailable: boolean;

  /** Starts a Bugsee session with the platform app token (`Bugsee.launch`). */
  launch(token: string): Promise<void>;

  /** Reports a handled exception (`Bugsee.logException`, else a fallback event). */
  logException(error: unknown, context?: Record<string, unknown>): void;

  /** Records a session breadcrumb (`Bugsee.event`). */
  event(name: string, properties?: Record<string, unknown>): void;

  /** Attaches an attribute to the report (`Bugsee.setAttribute`). */
  setAttribute(key: string, value: string | number | boolean): void;
}
