import type { SecureStore } from './SecureStore';

/**
 * In-memory `SecureStore` backed by a `Map`, for Tier-1 tests and any Node
 * context (where the expo-secure-store native module is unavailable).
 *
 * It mimics the real store's shape — string-only values, async surface, no
 * `clear()` / enumeration — so tests exercise the same contract as production.
 */
export class InMemorySecureStore implements SecureStore {
  private readonly store = new Map<string, string>();

  getItem(key: string): Promise<string | undefined> {
    return Promise.resolve(this.store.get(key));
  }

  setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  removeItem(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }
}
