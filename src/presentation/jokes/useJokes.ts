import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Joke } from '../../access/jokes/Joke';
import { useServices } from '../../framework/composition/ServicesProvider';
import { useObservable } from '../hooks/useObservable';
import { queryKeys } from '../queryKeys';

const NO_FAVORITES: Joke[] = [];

/**
 * Thin binding from the jokes service to React — both data paths side by side:
 * - fetched request/response data → React Query,
 * - live favorites state → `useObservable` on the service's BehaviorSubject.
 *
 * Heavy logic belongs in the Business/Access layers, not here.
 */
export function useJokes() {
  const { jokes } = useServices();

  const jokesQuery = useQuery({
    queryKey: queryKeys.jokes.list(),
    queryFn: () => jokes.fetchJokes(),
  });
  const favorites = useObservable(jokes.favorites$, NO_FAVORITES);

  const toggleFavorite = useCallback((joke: Joke) => jokes.toggleFavorite(joke), [jokes]);
  const isFavorite = useCallback(
    (joke: Joke) => favorites.some((favorite) => favorite.id === joke.id),
    [favorites],
  );

  return { jokesQuery, favorites, isFavorite, toggleFavorite };
}
