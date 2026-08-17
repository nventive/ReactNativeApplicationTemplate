import type { Logger } from '../logger/Logger';
import type { AnalyticsSink } from './AnalyticsSink';

/**
 * The default {@link AnalyticsSink}: it sends nowhere and simply logs each event
 * through the injected {@link Logger}. This is the "no-op that gives you
 * visibility" default — a project replaces it with a real provider at the
 * composition root without touching any call site.
 */
export class LoggingAnalyticsSink implements AnalyticsSink {
  constructor(private readonly logger: Logger) {}

  trackScreenView(screenName: string, params?: Record<string, unknown>): void {
    this.logger.info(`Analytics · screen_view: ${screenName}`, params);
  }

  trackEvent(name: string, properties?: Record<string, unknown>): void {
    this.logger.info(`Analytics · event: ${name}`, properties);
  }
}
