import { BehaviorSubject, type Observable } from 'rxjs';

import type { AnalyticsSink } from '../../access/analytics/AnalyticsSink';
import { favoriteJokesSchema, type Joke } from '../../access/jokes/Joke';
import type { JokesRepository } from '../../access/jokes/JokesRepository';
import type { Logger } from '../../access/logger/Logger';
import type { KeyValueStore } from '../../access/storage/KeyValueStore';
import type { JokesService } from './JokesService';

/** Storage key the favorites list is persisted under. */
const FAVORITES_KEY = 'jokes.favorites';

/**
 * Plain-TS implementation — no React imports, fully headless-testable.
 * Favorites are persisted through a single injected `KeyValueStore`.
 *
 * Favorites are the live **source of truth**: a `BehaviorSubject<Joke[]>`
 * rehydrated on construction and re-persisted on every mutation. Because
 * `KeyValueStore` (MMKV) is synchronous, rehydration happens inline in the
 * constructor — no async-in-constructor needed, since the read is immediate.
 * Every emission is a new immutable list.
 */
export class DefaultJokesService implements JokesService {
  private readonly _favorites$: BehaviorSubject<Joke[]>;
  readonly favorites$: Observable<Joke[]>;

  constructor(
    private readonly repository: JokesRepository,
    private readonly store: KeyValueStore,
    private readonly logger: Logger,
    private readonly analytics: AnalyticsSink,
  ) {
    this._favorites$ = new BehaviorSubject<Joke[]>(this.readPersistedFavorites());
    this.favorites$ = this._favorites$.asObservable();
  }

  fetchJokes(): Promise<Joke[]> {
    return this.repository.getJokes();
  }

  toggleFavorite(joke: Joke): void {
    const current = this._favorites$.getValue();
    const isFavorite = current.some((favorite) => favorite.id === joke.id);
    const next = isFavorite
      ? current.filter((favorite) => favorite.id !== joke.id)
      : [...current, joke];

    this._favorites$.next(next);
    this.persistFavorites(next);
    this.logger.info(
      isFavorite ? `Removed joke ${joke.id} from favorites` : `Added joke ${joke.id} to favorites`,
    );
    // A domain event through the analytics seam, alongside the navigation
    // screen-view tracking.
    this.analytics.trackEvent('joke_favorited', { id: joke.id, favorited: !isFavorite });
  }

  /**
   * Reads and validates the persisted favorites, **fail-soft**: stored data can
   * be stale/corrupt from an older app version, so a JSON or schema failure is
   * logged and treated as "no favorites" rather than thrown — the app still
   * boots (`doc/Serialization.md`).
   */
  private readPersistedFavorites(): Joke[] {
    const raw = this.store.getString(FAVORITES_KEY);
    if (raw === undefined) {
      return [];
    }

    try {
      const parsed = favoriteJokesSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        return parsed.data;
      }
      this.logger.warn('Discarding corrupt persisted favorites', parsed.error);
    } catch (error) {
      this.logger.warn('Discarding unreadable persisted favorites', error);
    }
    return [];
  }

  private persistFavorites(favorites: Joke[]): void {
    this.store.setString(FAVORITES_KEY, JSON.stringify(favorites));
  }
}
