/**
 * The app-review **rule** — the decision at the heart of "should we ask for a
 * review now?" — deliberately separated from the {@link AppReviewService}
 * plumbing (counting positive signals, persistence, the native gateway call,
 * logging) so each app can drop in its own rules without touching any of that.
 *
 * A policy is **pure and synchronous**: given the accumulated signal count and
 * the version state, it returns an {@link AppReviewDecision}. Keeping it free of
 * I/O and side effects makes an app's rules trivial to unit-test in isolation
 * (see `test/business/appReview/AppReviewPolicy.test.ts`) and impossible to
 * accidentally couple to storage or the native SDK.
 *
 * The default is {@link createDefaultAppReviewPolicy}. **To change the rules,
 * write another `AppReviewPolicy` and inject it into `DefaultAppReviewService`
 * at the composition root** (`createServices.ts`) — that is the intended seam;
 * every app is expected to tune this.
 */

/** What a policy sees when it decides whether to prompt. */
export interface AppReviewSignalContext {
  /**
   * Positive signals accumulated so far, **including the one being recorded by
   * this call**. It carries over across versions and is only reset after a
   * prompt actually fires — see `DefaultAppReviewService`.
   */
  readonly signalCount: number;
  /** The formatted version currently installed (e.g. `"1.2.0"`). */
  readonly currentVersion: string;
  /**
   * The version a prompt was last requested for, or `undefined` if the user has
   * never been prompted. Compare with {@link currentVersion} for
   * once-per-version / per-version rules.
   */
  readonly lastPromptedVersion: string | undefined;
}

/**
 * A policy's verdict: `prompt` now, or `skip` with a human-readable `reason`
 * that lands in the diagnostics log so it is clear why a prompt did or did not
 * fire.
 */
export type AppReviewDecision =
  { readonly outcome: 'prompt' } | { readonly outcome: 'skip'; readonly reason: string };

/** The pluggable app-review rule. See the module docblock. */
export type AppReviewPolicy = (context: AppReviewSignalContext) => AppReviewDecision;

/** Positive signals the default policy requires before a prompt is requested. */
export const DEFAULT_SIGNAL_THRESHOLD = 3;

/**
 * The built-in rule enforcing the two store-guideline constraints both platforms
 * apply: prompt only after {@link signalThreshold} positive signals, and **at
 * most once per installed version**. Signals carry over across versions (the
 * service never resets the count except after a successful prompt), so signals
 * earned before a version bump still count toward the next version's prompt.
 *
 * @param signalThreshold positive signals required (default
 *   {@link DEFAULT_SIGNAL_THRESHOLD}). Pass a different number for the common
 *   "same rules, different threshold" case; write a full {@link AppReviewPolicy}
 *   for anything more elaborate.
 */
export function createDefaultAppReviewPolicy(
  signalThreshold: number = DEFAULT_SIGNAL_THRESHOLD,
): AppReviewPolicy {
  return ({ signalCount, currentVersion, lastPromptedVersion }) => {
    if (signalCount < signalThreshold) {
      return {
        outcome: 'skip',
        reason: `below signal threshold (${signalCount}/${signalThreshold})`,
      };
    }
    if (lastPromptedVersion === currentVersion) {
      return { outcome: 'skip', reason: `already prompted for version ${currentVersion}` };
    }
    return { outcome: 'prompt' };
  };
}
