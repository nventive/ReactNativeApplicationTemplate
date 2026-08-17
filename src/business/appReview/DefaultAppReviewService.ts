import type { CurrentVersionRepository } from '../../access/appInfo/CurrentVersionRepository';
import type { AppReviewGateway } from '../../access/appReview/AppReviewGateway';
import type { Logger } from '../../access/logger/Logger';
import type { KeyValueStore } from '../../access/storage/KeyValueStore';
import { formatVersion } from '../../access/version/Version';
import type { AppReviewService } from './AppReviewService';

/** Persisted count of positive signals seen since the last successful prompt. */
const SIGNAL_COUNT_KEY = 'appReview.signalCount';
/** Persisted version string the prompt was last requested for. */
const LAST_PROMPTED_VERSION_KEY = 'appReview.lastPromptedVersion';

/** Positive signals required before the prompt is requested for a version. */
export const DEFAULT_SIGNAL_THRESHOLD = 3;

/**
 * Plain-TS {@link AppReviewService} — no React, fully Tier-1 testable.
 *
 * Policy (both store guidelines): prompt only after {@link signalThreshold}
 * positive signals, and only once per installed version. State lives in the
 * injected {@link KeyValueStore} so it survives restarts; the native prompt goes
 * through {@link AppReviewGateway}. Every branch is logged so the diagnostics log
 * viewer explains why a prompt did or didn't fire.
 */
export class DefaultAppReviewService implements AppReviewService {
  constructor(
    private readonly gateway: AppReviewGateway,
    private readonly store: KeyValueStore,
    private readonly currentVersionRepository: CurrentVersionRepository,
    private readonly logger: Logger,
    private readonly signalThreshold: number = DEFAULT_SIGNAL_THRESHOLD,
  ) {}

  async requestReviewIfAppropriate(): Promise<boolean> {
    try {
      const signals = (this.store.getNumber(SIGNAL_COUNT_KEY) ?? 0) + 1;
      this.store.setNumber(SIGNAL_COUNT_KEY, signals);
      if (signals < this.signalThreshold) {
        return false;
      }

      const currentVersion = formatVersion(await this.currentVersionRepository.getCurrentVersion());
      if (this.store.getString(LAST_PROMPTED_VERSION_KEY) === currentVersion) {
        this.logger.info(`App review already requested for version ${currentVersion}; skipping`);
        return false;
      }

      if (!(await this.gateway.isAvailable())) {
        this.logger.info('App review prompt unavailable on this platform/build; skipping');
        return false;
      }

      await this.gateway.requestReview();
      // Record the prompt and reset the counter so the next version starts fresh.
      this.store.setString(LAST_PROMPTED_VERSION_KEY, currentVersion);
      this.store.setNumber(SIGNAL_COUNT_KEY, 0);
      this.logger.info(`Requested app review prompt for version ${currentVersion}`);
      return true;
    } catch (error) {
      // A review prompt must never break the flow that triggered it.
      this.logger.warn('App review request failed; ignoring', error);
      return false;
    }
  }
}
