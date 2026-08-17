/**
 * The in-app store-review seam — the native "ask the OS to show its rating
 * prompt" surface behind an Access interface, so business logic depends on a
 * small, mockable contract instead of importing `expo-store-review` directly
 * (the same seam rule the rest of the Access layer follows).
 *
 * Implementations:
 * - `ExpoStoreReviewGateway` — the real one, the sole `expo-store-review`
 *   touchpoint (on device).
 * - `InMemoryAppReviewGateway` — records requests for Tier-1/Tier-2 tests and
 *   fully-offline (mock) runs.
 */
export interface AppReviewGateway {
  /**
   * Whether the platform can actually present a review flow right now. Mirrors
   * `expo-store-review`'s `hasAction()`: `true` only when native review is
   * available *and* store URLs are configured (iOS outside TestFlight, Android
   * 5+, a configured store listing). Callers **must** check this before
   * {@link requestReview}.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Asks the OS to present its native in-app review prompt. The OS decides
   * whether to actually show it (it is heavily rate-limited and never reports
   * the outcome), so this resolves regardless of what — if anything — the user
   * does. Never throw a review prompt at the user without a positive moment and
   * the business-layer rate limit (see `AppReviewService`).
   */
  requestReview(): Promise<void>;
}
