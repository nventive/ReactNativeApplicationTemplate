# Environments

Dev / Staging / Prod environments, selectable per build and switchable at
runtime (a `current` selection plus a `next` pending one, restart to apply). Two
cooperating halves.

## 1. Build default (`app.config.ts` + expo-constants)

Which environment a build defaults to is chosen by the `APP_ENV` build variable,
baked into [`app.config.ts`](../app.config.ts)'s `extra` and read at runtime
through expo-constants — set at build time:

```bash
APP_ENV=staging npx expo prebuild   # use cross-env on Windows, or a CI variable
```

[`getBuildDefaultEnvironment()`](../src/framework/config/appEnvironment.ts) is the
single place this value is read; it falls back to `development` if unset.

## 2. Runtime switching (`EnvironmentService`)

[`EnvironmentService`](../src/business/environment/EnvironmentService.ts) exposes
the active environment and its config, and persists a runtime override via
`KeyValueStore` (MMKV). **Features consume this service, never `app.config.ts`
directly** (convention).

```ts
const { environment } = useServices();
const { apiBaseUrl } = environment.getConfig(); // per-env values
```

Per-environment values live in a typed map,
[`environments.ts`](../src/business/environment/environments.ts) — type-safe
rather than `.env.*` files:

| Value | development | staging | production |
|-------|:-----------:|:-------:|:----------:|
| `logging.console` | on | off | off |
| `logging.file` | on | on | on |
| `logging.minimumLevel` | debug | info | warn |
| `diagnosticsEnabled` | on | on | off |
| `crashReportingEnabled` | on | on | **off** |
| `remoteConfig.fetchIntervalMinutes` | 1 | 1 | 720 |

`crashReportingEnabled` gates Bugsee to internal builds — off in production, which
is billed per user ([CrashReporting.md](CrashReporting.md)).
`remoteConfig.fetchIntervalMinutes` tunes the Firebase fetch cadence
([FirebaseRemoteConfig.md](FirebaseRemoteConfig.md)). (`apiBaseUrl` and
`appStoreUrl` are also per-env; the sample points `apiBaseUrl` at the public Dad
Jokes API in every environment, and `appStoreUrl` at placeholder store URLs.)

## Switching semantics (restart to apply)

- `setEnvironment(env)` **persists** the override and pushes it onto `pending$`.
  The active environment and the wired services graph do **not** change
  mid-session.
- The composition root reads the persisted override **once at startup** and wires
  the whole graph (HTTP base URL, logging levels, …) from that config.
- Applying a switch therefore **requires an app restart**. The diagnostics
  environment picker shows a "restart to apply" banner whenever `pending$`
  differs from the current environment.
- `reset()` deletes the override; the next launch reverts to the build default.

Live re-wiring on switch is deliberately avoided — applying a switch defers to a
restart because the environment feeds construction-time dependencies.

## Testing

`DefaultEnvironmentService` takes a `KeyValueStore` and the build default by
constructor, so Tier-1 tests drive it with an `InMemoryKeyValueStore` and an
explicit default — no expo-constants, no native modules
([test](../test/business/environment/DefaultEnvironmentService.test.ts)).
`MockEnvironmentService` is a no-persistence fake for consumers that just need a
fixed environment; it still drives `pending$` exactly like the real service
(`setEnvironment`/`reset`, including `reset()` raising the build default as
pending), so tests can rely on the same behavior.
