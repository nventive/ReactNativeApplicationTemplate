import type { Observable } from 'rxjs';

/**
 * Governs whether the diagnostics overlay is available. Availability combines
 * three things:
 *
 * 1. an **environment default** (`diagnosticsEnabled`, off in production),
 * 2. a **permanent disable** persisted across launches (the "DISABLE
 *    DIAGNOSTIC" action — requires clearing storage / reinstall to undo), and
 * 3. a **session dismissal** that hides the launcher until the next launch (the
 *    overlay's "X" button).
 */
export interface DiagnosticsService {
  /**
   * `true` while the diagnostics launcher should be shown. `false` in production
   * builds, after a permanent disable, or after a session dismissal.
   */
  readonly isAvailable$: Observable<boolean>;

  /** Synchronous snapshot of {@link isAvailable$}. */
  isAvailable(): boolean;

  /** Hides the overlay for the rest of this app run (not persisted). */
  dismissForSession(): void;

  /**
   * Persists a permanent disable; the overlay stays hidden on future launches.
   * Synchronous — the underlying `KeyValueStore` (MMKV) write is synchronous, so
   * there is nothing to await.
   */
  disablePermanently(): void;
}
