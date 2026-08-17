/**
 * A synchronous key/value persistence contract for non-sensitive data.
 *
 * This is the shared storage abstraction. The "every Access dependency is an
 * interface with a real + mock" rule, plus the fact that the real backend (MMKV)
 * is a native module absent under Jest, make a single injected store the right
 * design here.
 *
 * Implementations: `MmkvKeyValueStore` (react-native-mmkv, on device) and
 * `InMemoryKeyValueStore` (a `Map`, for Tier-1 tests and any Node context).
 * Feature repositories take a `KeyValueStore` by constructor injection and own
 * their own keys and their own (de)serialization (see `doc/Serialization.md`).
 *
 * The contract is **synchronous** on purpose: MMKV is synchronous, and that
 * ergonomic win is the reason it is chosen over the async AsyncStorage. Feature
 * repositories that want a uniform `Promise`-returning shape (like
 * `JokesRepository`) wrap these calls in `Promise.resolve(...)` themselves.
 *
 * For sensitive values (tokens, credentials) use `SecureStore`, not this store.
 */
export interface KeyValueStore {
  /** Returns the string stored at `key`, or `undefined` if absent. */
  getString(key: string): string | undefined;
  /** Stores a string value. */
  setString(key: string, value: string): void;

  /** Returns the boolean stored at `key`, or `undefined` if absent. */
  getBoolean(key: string): boolean | undefined;
  /** Stores a boolean value. */
  setBoolean(key: string, value: boolean): void;

  /** Returns the number stored at `key`, or `undefined` if absent. */
  getNumber(key: string): number | undefined;
  /** Stores a number value. */
  setNumber(key: string, value: number): void;

  /** Whether a value is stored at `key`. */
  contains(key: string): boolean;
  /** Removes the value at `key` (no-op if absent). */
  remove(key: string): void;
  /** Removes every value in the store. */
  clear(): void;
  /** Enumerates every key currently stored. */
  getAllKeys(): string[];
}
