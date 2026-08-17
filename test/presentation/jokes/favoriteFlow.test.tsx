/**
 * Tier 2 — the Dad Jokes favorite flow. Complements
 * `RootNavigator.test.tsx` (which favorites from the list) by driving the
 * favorite/unfavorite path from the **detail** screen and asserting cross-screen
 * consistency through the shared `favorites$` observable.
 *
 * Toggle presses are wrapped in `await act(async () => …)`: `toggleFavorite`
 * emits on the RxJS source synchronously, but the `useObservable` bridge applies
 * it via a passive-effect subscription, so an async act flush is what makes the
 * re-render observable to the assertions (on device React flushes it after the
 * event handler — this is a test-harness concern only).
 */
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Side-effect import: initialize i18n so screens render translated (English) copy.
import '../../../src/framework/i18n';
import type { Joke } from '../../../src/access/jokes/Joke';
import type { JokesRepository } from '../../../src/access/jokes/JokesRepository';
import { createServices } from '../../../src/framework/composition/createServices';
import { ServicesProvider } from '../../../src/framework/composition/ServicesProvider';
import { RootNavigator } from '../../../src/presentation/navigation/RootNavigator';
import { ThemeProvider } from '../../../src/presentation/theme';

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
      <ThemeProvider>
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </QueryClientProvider>
        </ServicesProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

/** Press an element that mutates the favorites observable, flushing the bridge. */
async function pressAndFlush(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

describe('Dad Jokes favorite flow', () => {
  it('favorites from the detail screen and reflects it on the Favorites tab', async () => {
    await renderShell();
    await screen.findByText('First fixture joke');

    // Open the detail screen for the first joke.
    fireEvent.press(screen.getByTestId('JokeDetailButton-h1'));
    await screen.findByTestId('JokeDetail');
    expect(screen.getByText('Add to favorites')).toBeOnTheScreen();

    // Favorite it there; the button flips to the "remove" label.
    await pressAndFlush('ToggleFavoriteButton');
    expect(screen.getByText('Remove from favorites')).toBeOnTheScreen();

    // It now shows on the Favorites tab (cross-screen via the observable).
    fireEvent.press(screen.getByText('Favorites'));
    const favorites = await screen.findByTestId('FavoritesContainer');
    expect(within(favorites).getByText('First fixture joke')).toBeOnTheScreen();
  });

  it('favorites from the list and unfavorites from the detail screen', async () => {
    await renderShell();
    await screen.findByText('First fixture joke');

    // Favorite the first joke from its list row.
    await pressAndFlush('JokeListItem-h1');

    // Open the detail screen — it reflects the favorite set from the list
    // (cross-screen consistency through the shared observable).
    fireEvent.press(screen.getByTestId('JokeDetailButton-h1'));
    await screen.findByTestId('JokeDetail');
    expect(await screen.findByText('Remove from favorites')).toBeOnTheScreen();

    // Unfavorite from the detail screen; the button label flips back.
    await pressAndFlush('ToggleFavoriteButton');
    expect(screen.getByText('Add to favorites')).toBeOnTheScreen();
  });
});
