import { combineLatest, from, type Observable } from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';

import type { CurrentVersionRepository } from '../../access/appInfo/CurrentVersionRepository';
import type { RemoteConfigProvider } from '../../access/remoteConfig/RemoteConfigProvider';
import { compareVersions } from '../../access/version/Version';
import type { ForcedUpdateService } from './ForcedUpdateService';

/**
 * Plain-TS {@link ForcedUpdateService} — no React, fully headless-testable.
 *
 * It combines the installed version (read once, async) with the remote-config
 * stream and emits `true` whenever `currentVersion < minimumVersion`. It is kept
 * live (an Observable) rather than one-shot so the gate recovers when the remote
 * minimum drops back down.
 *
 * `shareReplay(1)` makes the stream multicast + late-subscriber friendly: the
 * gate and any test both see the current value immediately, and the installed
 * version is read only once.
 */
export class DefaultForcedUpdateService implements ForcedUpdateService {
  readonly isUpdateRequired$: Observable<boolean>;

  constructor(
    remoteConfig: RemoteConfigProvider,
    currentVersionRepository: CurrentVersionRepository,
  ) {
    const currentVersion$ = from(currentVersionRepository.getCurrentVersion());

    this.isUpdateRequired$ = combineLatest([currentVersion$, remoteConfig.values$]).pipe(
      map(([current, config]) => compareVersions(current, config.minimumVersion) < 0),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }
}
