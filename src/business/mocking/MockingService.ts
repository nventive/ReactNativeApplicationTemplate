import type { Observable } from 'rxjs';

/**
 * Controls whether the app runs against **mock** Access implementations instead
 * of the real ones.
 *
 * Like the environment switch, mocking is **applied on restart**: the
 * composition root reads the persisted flag once at startup and wires the mock
 * or real repositories (and the mock or real remote-config provider) from it.
 * Toggling at runtime persists the new value and raises a "restart to apply"
 * banner ({@link hasPendingChange$}) but does not re-wire the running graph.
 */
export interface MockingService {
  /** The effective flag this session was wired with (and the persisted value). */
  readonly isEnabled$: Observable<boolean>;

  /** Synchronous snapshot of {@link isEnabled$}. */
  isEnabled(): boolean;

  /**
   * `true` once the flag has been toggled away from the value the running graph
   * was built with — i.e. a restart is needed to apply it. Drives the banner.
   */
  readonly hasPendingChange$: Observable<boolean>;

  /** Persists the new mocking flag and updates the pending-change state. */
  setEnabled(enabled: boolean): void;

  /** Flips the current flag. */
  toggle(): void;
}
