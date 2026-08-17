import type { Observable } from 'rxjs';

import type { Joke } from '../../access/jokes/Joke';

/**
 * Business contract for the Dad Jokes feature.
 *
 * Two data paths coexist:
 * - `fetchJokes()` — request/response data, consumed upstream via React Query.
 * - `favorites$` — live domain state many screens react to, consumed via the
 *   `useObservable` bridge.
 */
export interface JokesService {
  /** Fetches the current list of jokes from the repository. */
  fetchJokes(): Promise<Joke[]>;

  /**
   * The favorite jokes — live source of truth backed by a `BehaviorSubject`.
   * Emits the full list on every change.
   */
  readonly favorites$: Observable<Joke[]>;

  /** Adds the joke to favorites, or removes it if already present. */
  toggleFavorite(joke: Joke): void;
}
