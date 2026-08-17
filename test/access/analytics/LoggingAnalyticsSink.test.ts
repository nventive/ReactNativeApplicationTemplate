/**
 * Tier 1 — the default analytics sink. It sends nowhere; it just logs each event
 * through the injected `Logger` (visibility with no backend). A project swaps a
 * real provider at the composition root without touching any call site.
 */
import { LoggingAnalyticsSink } from '../../../src/access/analytics/LoggingAnalyticsSink';
import { MockLogger } from '../../../src/access/logger/MockLogger';

describe('LoggingAnalyticsSink', () => {
  it('logs a screen view through the logger, carrying the screen name and params', () => {
    const logger = new MockLogger();
    const sink = new LoggingAnalyticsSink(logger);

    sink.trackScreenView('JokesScreen', { tab: 'jokes' });

    const info = logger.entriesOf('info');
    expect(info).toHaveLength(1);
    expect(info[0].message).toContain('screen_view');
    expect(info[0].message).toContain('JokesScreen');
    expect(info[0].meta).toEqual({ tab: 'jokes' });
  });

  it('logs a domain event through the logger, carrying the name and properties', () => {
    const logger = new MockLogger();
    const sink = new LoggingAnalyticsSink(logger);

    sink.trackEvent('joke_favorited', { jokeId: '17urj7q' });

    const info = logger.entriesOf('info');
    expect(info).toHaveLength(1);
    expect(info[0].message).toContain('joke_favorited');
    expect(info[0].meta).toEqual({ jokeId: '17urj7q' });
  });

  it('logs an event with no properties', () => {
    const logger = new MockLogger();
    const sink = new LoggingAnalyticsSink(logger);

    sink.trackEvent('app_opened');

    expect(logger.entriesOf('info')).toHaveLength(1);
  });
});
