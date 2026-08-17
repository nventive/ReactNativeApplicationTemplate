import * as StoreReview from 'expo-store-review';

import type { AppReviewGateway } from './AppReviewGateway';

/**
 * {@link AppReviewGateway} backed by `expo-store-review` — the **only** file that
 * touches the SDK, so swapping the review provider (or stubbing it in tests) is a
 * one-file change at the composition root, the same shape as
 * {@link LinkingUrlLauncher} wrapping core `Linking`.
 *
 * `isAvailable` uses `hasAction()` (platform capability **plus** configured
 * store URLs) rather than `isAvailableAsync()`, so a `true` result means
 * `requestReview()` can genuinely do something.
 */
export class ExpoStoreReviewGateway implements AppReviewGateway {
  isAvailable(): Promise<boolean> {
    return StoreReview.hasAction();
  }

  async requestReview(): Promise<void> {
    await StoreReview.requestReview();
  }
}
