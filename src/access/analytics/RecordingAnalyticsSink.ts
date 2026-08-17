import type { AnalyticsSink } from './AnalyticsSink';

/** A tracked screen view or event, captured by {@link RecordingAnalyticsSink}. */
export interface AnalyticsRecord {
  readonly type: 'screen_view' | 'event';
  readonly name: string;
  readonly data?: Record<string, unknown>;
}

/**
 * In-memory {@link AnalyticsSink} for Tier-1/Tier-2 assertions ("favoriting a
 * joke tracked a `joke_favorited` event"). Records every call; asserts nothing.
 */
export class RecordingAnalyticsSink implements AnalyticsSink {
  readonly records: AnalyticsRecord[] = [];

  trackScreenView(screenName: string, params?: Record<string, unknown>): void {
    this.records.push({ type: 'screen_view', name: screenName, data: params });
  }

  trackEvent(name: string, properties?: Record<string, unknown>): void {
    this.records.push({ type: 'event', name, data: properties });
  }

  /** Every recorded entry of the given kind. */
  recordsOf(type: AnalyticsRecord['type']): AnalyticsRecord[] {
    return this.records.filter((record) => record.type === type);
  }
}
