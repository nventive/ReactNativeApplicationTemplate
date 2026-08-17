import type { AppReviewGateway } from './AppReviewGateway';

/**
 * In-memory {@link AppReviewGateway} for Tier-1/Tier-2 tests and fully-offline
 * (mock) runs: it counts {@link requestReview} calls and reports availability
 * from a constructor flag, presenting nothing. It is a recording fake like the
 * other in-memory doubles (`RecordingAnalyticsSink`, `InMemoryKeyValueStore`).
 */
export class InMemoryAppReviewGateway implements AppReviewGateway {
  /** How many times {@link requestReview} has been called. */
  requestedCount = 0;

  constructor(private readonly available = true) {}

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.available);
  }

  requestReview(): Promise<void> {
    this.requestedCount += 1;
    return Promise.resolve();
  }
}
