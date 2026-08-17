/**
 * Business contract for prompting the user to rate the app.
 *
 * The service owns the **policy** — the *when* — so Presentation only has to
 * signal a positive moment; it never decides whether the OS prompt is
 * appropriate. Two rules keep the prompt from annoying users (the store
 * guidelines both platforms enforce):
 * - it fires only after enough positive signals have accumulated, and
 * - it fires **at most once per installed app version**.
 *
 * The native call itself lives behind {@link AppReviewGateway}; this service is
 * the plain-TS decision layer over it, fully headless-testable.
 */
export interface AppReviewService {
  /**
   * Records a positive signal (e.g. the user submitted feedback, favorited a
   * few jokes, completed a flow) and, **if the policy allows**, asks the OS to
   * present its in-app review prompt.
   *
   * Safe to call often: it no-ops until the signal threshold is met and the
   * once-per-version guard permits another request. Resolves to `true` only when
   * a prompt was actually requested (useful for tests/telemetry); it never
   * throws — a review prompt must never break the flow that triggered it.
   */
  requestReviewIfAppropriate(): Promise<boolean>;
}
