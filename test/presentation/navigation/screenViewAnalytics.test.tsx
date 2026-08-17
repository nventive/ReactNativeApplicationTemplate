/**
 * Tier 2 — React runtime, headless. Asserts the navigation observer reports a
 * screen view through the analytics seam for the initial route.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../../../src/framework/i18n';
import { RecordingAnalyticsSink } from '../../../src/access/analytics/RecordingAnalyticsSink';
import type { Joke } from '../../../src/access/jokes/Joke';
import type { JokesRepository } from '../../../src/access/jokes/JokesRepository';
import { createServices } from '../../../src/framework/composition/createServices';
import { ServicesProvider } from '../../../src/framework/composition/ServicesProvider';
import { NavigationRoot } from '../../../src/presentation/navigation/NavigationRoot';
import { ThemeProvider } from '../../../src/presentation/theme';

class FakeJokesRepository implements JokesRepository {
  getJokes(): Promise<Joke[]> {
    return Promise.resolve([{ id: 'a1', title: 'Analytics joke', text: 'body' }]);
  }
}

let activeQueryClient: QueryClient | undefined;
afterEach(() => {
  activeQueryClient?.clear();
  activeQueryClient = undefined;
});

describe('screen-view analytics', () => {
  it('records a screen view for the initial route', async () => {
    const analytics = new RecordingAnalyticsSink();
    const services = createServices({ analytics, jokesRepository: new FakeJokesRepository() });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    activeQueryClient = queryClient;

    await render(
      <SafeAreaProvider>
        <ThemeProvider>
          <ServicesProvider services={services}>
            <QueryClientProvider client={queryClient}>
              <NavigationRoot />
            </QueryClientProvider>
          </ServicesProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    await screen.findByText('Analytics joke');

    const views = analytics.recordsOf('screen_view');
    expect(views.length).toBeGreaterThan(0);
    expect(views.map((v) => v.name)).toContain('JokesList');
  });
});
