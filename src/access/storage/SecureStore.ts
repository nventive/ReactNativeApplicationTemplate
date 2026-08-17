/**
 * An asynchronous key/value contract for **sensitive** values — auth tokens,
 * credentials, anything that must live in the OS keychain / keystore rather
 * than plain storage.
 *
 * The template ships this seam now — using the OS keychain / keystore for
 * secrets — so that when an auth feature lands, tokens go straight to secure
 * storage with no rework.
 *
 * Implementations: `ExpoSecureStore` (expo-secure-store — Keychain on iOS,
 * Keystore on Android) and `InMemorySecureStore` (a `Map`, for Tier-1 tests).
 *
 * The contract is **asynchronous** — the intentional asymmetry with the
 * synchronous `KeyValueStore` — because keychain access is inherently async.
 *
 * Constraints inherited from expo-secure-store, which shape this interface:
 * - **String values only** (serialize objects yourself before storing).
 * - **No `clear()` and no key enumeration.** To wipe secrets, `removeItem` each
 *   known key — so keep secret key names as constants in one place (see the
 *   sensitive-vs-plain rule in `doc/LocalStorage.md`).
 * - Android values are limited to ~2 KB; use it for secrets, not blobs.
 */
export interface SecureStore {
  /** Returns the secret stored at `key`, or `undefined` if absent. */
  getItem(key: string): Promise<string | undefined>;
  /** Stores a secret value. */
  setItem(key: string, value: string): Promise<void>;
  /** Removes the secret at `key` (no-op if absent). */
  removeItem(key: string): Promise<void>;
}
