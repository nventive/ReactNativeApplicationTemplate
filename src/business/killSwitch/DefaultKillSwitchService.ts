import type { Observable } from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';

import type { RemoteConfigProvider } from '../../access/remoteConfig/RemoteConfigProvider';
import type { KillSwitchService } from './KillSwitchService';

/**
 * Plain-TS {@link KillSwitchService} — no React, headless-testable. A thin
 * derivation of the remote-config stream down to the kill-switch flag.
 * `distinctUntilChanged` ensures only real state changes drive the gate.
 */
export class DefaultKillSwitchService implements KillSwitchService {
  readonly isKillSwitchActive$: Observable<boolean>;

  constructor(remoteConfig: RemoteConfigProvider) {
    this.isKillSwitchActive$ = remoteConfig.values$.pipe(
      map((config) => config.killSwitchActive),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }
}
