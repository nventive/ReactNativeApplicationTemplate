/**
 * The analytics seam — every screen view and domain event the app reports goes
 * through this one interface, never a vendor SDK directly. Swapping in Firebase
 * Analytics / Segment later is a one-file change at the composition root, the
 * same seam crash reporting uses.
 */
export interface AnalyticsSink {
  /**
   * Records a screen/page view. Called from the navigation observer with the
   * active route name.
   */
  trackScreenView(screenName: string, params?: Record<string, unknown>): void;

  /**
   * Records a domain event (e.g. `joke_favorited`). Called from Business or
   * Presentation through this interface only.
   */
  trackEvent(name: string, properties?: Record<string, unknown>): void;
}
