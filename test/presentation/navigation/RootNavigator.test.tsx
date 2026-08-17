/**
 * Tier 2 — React runtime, headless. Drives the navigation shell through RTL:
 * initial screen, pushed detail (typed params), the modal, and cross-tab
 * favorites consistency via the observable. Native transition/gesture/back
 * behavior is device-only (Maestro) — out of scope here.
 */
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Side-effect import: initialize i18n so screens render translated strings
// (English) rather than raw keys.
import '../../../src/framework/i18n';
import type { Joke } from '../../../src/access/jokes/Joke';
import type { JokesRepository } from '../../../src/access/jokes/JokesRepository';
import { createServices } from '../../../src/framework/composition/createServices';
import { ServicesProvider } from '../../../src/framework/composition/ServicesProvider';
import { RootNavigator } from '../../../src/presentation/navigation/RootNavigator';

const fixtureJokes: Joke[] = [
  { id: 'h1', title: 'First fixture joke', text: 'First body' },
  { id: 'h2', title: 'Second fixture joke', text: 'Second body' },
];

class FakeJokesRepository implements JokesRepository {
  getJokes(): Promise<Joke[]> {
    return Promise.resolve(fixtureJokes);
  }
}

let activeQueryClient: QueryClient | undefined;

afterEach(() => {
  // Drop cached queries so their gc/notify timers don't hold the worker open.
  activeQueryClient?.clear();
  activeQueryClient = undefined;
});

async function renderShell() {
  const services = createServices({ jokesRepository: new FakeJokesRepository() });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  activeQueryClient = queryClient;
  return render(
    <SafeAreaProvider>
      <ServicesProvider services={services}>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </ServicesProvider>
    </SafeAreaProvider>,
  );
}

describe('RootNavigator', () => {
  it('shows the Dad Jokes list and both tabs on launch', async () => {
    await renderShell();

    expect(await screen.findByText('First fixture joke')).toBeOnTheScreen();
    expect(screen.getByText('Favorites')).toBeOnTheScreen();
    expect(screen.getAllByText('Dad Jokes').length).toBeGreaterThan(0);
  });

  it('pushes the typed detail screen from the list chevron', async () => {
    await renderShell();
    await screen.findByText('First fixture joke');

    fireEvent.press(screen.getByTestId('JokeDetailButton-h1'));

    const detail = await screen.findByTestId('JokeDetail');
    expect(within(detail).getByText('First fixture joke')).toBeOnTheScreen();
    expect(within(detail).getByText('First body')).toBeOnTheScreen();
  });

  it('presents the example modal from the list header', async () => {
    await renderShell();
    await screen.findByText('First fixture joke');

    fireEvent.press(screen.getByTestId('OpenModalButton'));

    expect(await screen.findByTestId('ExampleModal')).toBeOnTheScreen();
  });

  it('reflects a favorite across tabs through the observable', async () => {
    await renderShell();
    await screen.findByText('First fixture joke');

    // Favoriting on the Dad Jokes tab (row tap) ...
    fireEvent.press(screen.getByTestId('JokeListItem-h1'));

    // ... shows up on the Favorites tab.
    fireEvent.press(screen.getByText('Favorites'));

    const favorites = await screen.findByTestId('FavoritesContainer');
    await waitFor(() =>
      expect(within(favorites).getByText('First fixture joke')).toBeOnTheScreen(),
    );
  });
});
