import type { CurrentVersionRepository } from '../../access/appInfo/CurrentVersionRepository';
import type { AppReviewGateway } from '../../access/appReview/AppReviewGateway';
import { LOG_CATEGORY_KEY } from '../../access/logger/LogCategory';
import type { Logger } from '../../access/logger/Logger';
import type { KeyValueStore } from '../../access/storage/KeyValueStore';
import { formatVersion } from '../../access/version/Version';
import { createDefaultAppReviewPolicy, type AppReviewPolicy } from './AppReviewPolicy';
import type { AppReviewService } from './AppReviewService';

/** Persisted count of positive signals seen (carried over, see below). */
const SIGNAL_COUNT_KEY = 'appReview.signalCount';
/** Persisted version string the prompt was last requested for. */
const LAST_PROMPTED_VERSION_KEY = 'appReview.lastPromptedVersion';

/** Log category stamped on this service's entries (filterable in the console). */
const LOG_CATEGORY = 'appReview';

// Re-exported for callers that reference the default threshold (its home is the
// policy module, where the default rule lives).
export { DEFAULT_SIGNAL_THRESHOLD } from './AppReviewPolicy';

/**
 * Plain-TS {@link AppReviewService} — no React, fully Tier-1 testable.
 *
 * This service owns the **plumbing** — counting positive signals, persisting
 * state across restarts through the injected {@link KeyValueStore}, calling the
 * native prompt through {@link AppReviewGateway}, and logging every branch so the
 * diagnostics log viewer explains why a prompt did or didn't fire. The **rule**
 * — whether a prompt is appropriate given the current state — is delegated to an
 * injected {@link AppReviewPolicy}, so an app tunes *when* to prompt without
 * reimplementing any of this (see {@link AppReviewPolicy} for the seam).
 *
 * **Carry-over counter (intentional):** the signal count is only reset after a
 * prompt actually fires. Signals that accumulate below the threshold — or while
 * a prompt is declined or the gateway is unavailable — persist and count toward
 * a future prompt, including one in a later app version. The default policy
 * treats this as "N lifetime positive signals, then once per version"; a policy
 * that wants strict per-version counting can key off `lastPromptedVersion` vs
 * `currentVersion` instead.
 */
export class DefaultAppReviewService implements AppReviewService {
  constructor(
    private readonly gateway: AppReviewGateway,
    private readonly store: KeyValueStore,
    private readonly currentVersionRepository: CurrentVersionRepository,
    private readonly logger: Logger,
    private readonly policy: AppReviewPolicy = createDefaultAppReviewPolicy(),
  ) {}

  async requestReviewIfAppropriate(): Promise<boolean> {
    try {
      const signalCount = (this.store.getNumber(SIGNAL_COUNT_KEY) ?? 0) + 1;
      this.store.setNumber(SIGNAL_COUNT_KEY, signalCount);

      const currentVersion = formatVersion(await this.currentVersionRepository.getCurrentVersion());
      const lastPromptedVersion = this.store.getString(LAST_PROMPTED_VERSION_KEY);

      const decision = this.policy({ signalCount, currentVersion, lastPromptedVersion });
      if (decision.outcome === 'skip') {
        this.logger.info(`App review prompt not appropriate: ${decision.reason}`, {
          [LOG_CATEGORY_KEY]: LOG_CATEGORY,
        });
        return false;
      }

      if (!(await this.gateway.isAvailable())) {
        this.logger.info('App review prompt unavailable on this platform/build; skipping', {
          [LOG_CATEGORY_KEY]: LOG_CATEGORY,
        });
        return false;
      }

      await this.gateway.requestReview();
      // Record the prompt and reset the counter so the next version starts fresh.
      this.store.setString(LAST_PROMPTED_VERSION_KEY, currentVersion);
      this.store.setNumber(SIGNAL_COUNT_KEY, 0);
      this.logger.info(`Requested app review prompt for version ${currentVersion}`, {
        [LOG_CATEGORY_KEY]: LOG_CATEGORY,
      });
      return true;
    } catch (error) {
      // A review prompt must never break the flow that triggered it.
      this.logger.warn('App review request failed; ignoring', error, {
        [LOG_CATEGORY_KEY]: LOG_CATEGORY,
      });
      return false;
    }
  }
}
