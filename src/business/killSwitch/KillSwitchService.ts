import type { Observable } from 'rxjs';

/**
 * Observes the remote kill switch. When active, the app is blocked behind a
 * message screen; when the flag lifts, the block is removed and the user is
 * returned to the app (fully recoverable in-session). Forced update takes
 * precedence over the kill switch (enforced by the gate).
 */
export interface KillSwitchService {
  /**
   * `true` while the remote kill switch is active. Emits the current state
   * immediately and on every remote change.
   */
  readonly isKillSwitchActive$: Observable<boolean>;
}
