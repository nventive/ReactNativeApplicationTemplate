/**
 * Tier 2 — React runtime, headless. The hook is exercised against the REAL
 * service graph with only the repository faked, wrapped in the same providers
 * the app shell uses.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Joke } from '../../../src/access/jokes/Joke';
import type { JokesRepository } from '../../../src/access/jokes/JokesRepository';
import { createServices } from '../../../src/framework/composition/createServices';
import { ServicesProvider } from '../../../src/framework/composition/ServicesProvider';
import { useJokes } from '../../../src/presentation/jokes/useJokes';

const fixtureJokes: Joke[] = [
  { id: 'h1', title: 'Hook joke 1', text: 'Text 1' },
  { id: 'h2', title: 'Hook joke 2', text: 'Text 2' },
];

class FakeJokesRepository implements JokesRepository {
  getJokes(): Promise<Joke[]> {
    return Promise.resolve(fixtureJokes);
  }
}

function createWrapper() {
  const services = createServices({ jokesRepository: new FakeJokesRepository() });
  // retry: false → failures surface immediately; gcTime: Infinity → no
  // garbage-collection timers left running after the test (open handles).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ServicesProvider services={services}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ServicesProvider>
    );
  }
  return Wrapper;
}

describe('useJokes', () => {
  it('loads jokes through React Query', async () => {
    const { result } = await renderHook(() => useJokes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.jokesQuery.isSuccess).toBe(true));

    expect(result.current.jokesQuery.data).toEqual(fixtureJokes);
  });

  it('reflects favorite toggles through the observable', async () => {
    const { result } = await renderHook(() => useJokes(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.jokesQuery.isSuccess).toBe(true));

    expect(result.current.favorites).toEqual([]);
    expect(result.current.isFavorite(fixtureJokes[0])).toBe(false);

    await act(() => {
      result.current.toggleFavorite(fixtureJokes[0]);
    });

    expect(result.current.favorites).toEqual([fixtureJokes[0]]);
    expect(result.current.isFavorite(fixtureJokes[0])).toBe(true);

    await act(() => {
      result.current.toggleFavorite(fixtureJokes[0]);
    });

    expect(result.current.favorites).toEqual([]);
  });
});
