import type { Observable } from 'rxjs';

/**
 * Decides whether the installed app is too old to keep running by observing the
 * remote minimum version against the installed one.
 *
 * Exposes a live `Observable<boolean>`, so the blocking gate both **blocks**
 * when the remote minimum exceeds the installed version and **lifts** if the
 * minimum is lowered again (recovery is observable — it lifts when the flag
 * clears). The gate gives forced update precedence over the kill switch.
 */
export interface ForcedUpdateService {
  /**
   * `true` while the installed version is below the remote minimum. Backed by
   * the remote-config stream and the installed version; emits the current state
   * immediately and on every remote change.
   */
  readonly isUpdateRequired$: Observable<boolean>;
}
