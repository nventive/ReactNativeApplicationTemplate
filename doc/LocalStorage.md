# Local storage

Persistence for the app, split into two stores by sensitivity. Both stores sit
behind Access-layer interfaces so they can be mocked and swapped, following the
"interface + real + mock" rule.

| Store | Interface | Real impl | Mock | Use for |
|-------|-----------|-----------|------|---------|
| Key-value | [`KeyValueStore`](../src/access/storage/KeyValueStore.ts) | [`MmkvKeyValueStore`](../src/access/storage/MmkvKeyValueStore.ts) (react-native-mmkv) | [`InMemoryKeyValueStore`](../src/access/storage/InMemoryKeyValueStore.ts) | Non-sensitive data: settings, flags, the environment override, cached favorites |
| Secure | [`SecureStore`](../src/access/storage/SecureStore.ts) | [`ExpoSecureStore`](../src/access/storage/ExpoSecureStore.ts) (expo-secure-store) | [`InMemorySecureStore`](../src/access/storage/InMemorySecureStore.ts) | Secrets: auth tokens, credentials |

## The sensitive-vs-plain rule

- **Anything secret goes in `SecureStore`** — it is backed by the iOS Keychain /
  Android Keystore. Tokens, refresh tokens, credentials.
- **Everything else goes in `KeyValueStore`** — MMKV is fast and synchronous but
  is *not* encrypted-by-default storage; never put secrets there.

Shipping `SecureStore` now is a deliberate choice so an auth feature drops tokens
straight into the keychain with no rework.

## `KeyValueStore` — synchronous, typed

MMKV is synchronous, and that ergonomic win is why it is chosen over the async
AsyncStorage — so the interface is synchronous too:

```ts
const flag = keyValueStore.getBoolean('mocking.enabled') ?? false;
keyValueStore.setString('environment.override', 'staging');
```

Typed getters return `undefined` when a key is absent (or holds a different
type). A feature repository that wants a uniform `Promise` shape (like
`JokesRepository`) wraps these calls in `Promise.resolve(...)` itself — the
store stays synchronous.

## `SecureStore` — asynchronous, string-only

Keychain access is inherently async, so this interface is the intentional
asymmetry:

```ts
await secureStore.setItem('auth.accessToken', token);
const token = await secureStore.getItem('auth.accessToken'); // string | undefined
```

Constraints inherited from expo-secure-store, reflected in the interface:

- **String values only** — serialize objects yourself before storing.
- **No `clear()` and no key enumeration.** To wipe secrets you must `removeItem`
  each known key, so keep secret key names as constants in one place.
- Android values are limited to ~2 KB — secrets, not blobs.

## Wiring & testing

Both stores are constructed once in
[`createServices.ts`](../src/framework/composition/createServices.ts) and injected
into consumers by constructor. The `keyValueStore` / `secureStore` overrides let
tests swap in the in-memory implementations:

```ts
const services = createServices({ keyValueStore: new InMemoryKeyValueStore() });
```

The native modules (MMKV, expo-secure-store) are unavailable under Jest, so
**Tier-1 tests always use the in-memory implementations** — never instantiate the
real ones off-device. (`createServices()`'s default `MmkvKeyValueStore` stays
importable in tests via a jest mock; see `jest.config.js`.)

Objects are stored as JSON strings and parsed back with a zod schema at the
boundary — see [Serialization.md](Serialization.md).
