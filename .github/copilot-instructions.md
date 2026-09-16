# Copilot instructions

React Native + TypeScript mobile app (Expo, Continuous Native Generation) with a
layered architecture, MVVM-style state, and a composition-root DI seam.

This repository is the **template** apps are generated from (`yarn generate`,
see [doc/ProjectGenerator.md](../doc/ProjectGenerator.md)). Generated apps drop
the governance/scaffolding files and the `cli/` folder.

[CLAUDE.md](../CLAUDE.md) holds the same guidance in more detail; `doc/` holds
one permanent page per cross-cutting concern ([doc/README.md](../doc/README.md)
is the index, [doc/Architecture.md](../doc/Architecture.md) the best start).

## Commands

Package manager is **Yarn 1 (classic)** — `yarn add <pkg>` / `yarn add -D <pkg>`,
never `npm install`. Use `npx expo install <pkg>` for Expo/RN libraries so
versions stay SDK-compatible.

```sh
yarn typecheck && yarn lint && yarn test   # the verify loop; must pass before proposing a change
yarn lint:fix                              # ESLint + Prettier autofix
yarn test:coverage                         # coverage report (diagnostic, not a gate)
yarn android / yarn ios / yarn start       # expo run:android / run:ios / Metro only
yarn e2e                                   # Maestro flows (device/CI only)
yarn audit:scan                            # dependency (SCA) audit
```

Running a subset of tests (Jest takes a path regex / `-t` name filter):

```sh
yarn test test/business/jokes/DefaultJokesService.test.ts   # one file
yarn test jokes                                             # path substring
yarn test -t 'toggleFavorite'                               # one test by name
yarn test --watch src/presentation                          # watch a folder
```

`yarn typecheck` checks both `tsconfig.json` and `cli/tsconfig.json`. Jest roots
are `src/`, `test/`, and `cli/`.

## Architecture

Dependencies point strictly downward; inside every layer code is grouped
**by feature** (`access/jokes/`, `business/jokes/`, `presentation/jokes/`).

| Layer | Folder | Contains | May depend on |
|-------|--------|----------|---------------|
| Access (DAL) | `src/access/` | HTTP clients, storage, native wrappers, zod-parsed DTOs | nothing above it |
| Business | `src/business/` | Domain services & immutable entities (plain TS, RxJS) | Access interfaces |
| Presentation | `src/presentation/` | Screens, hooks, navigation, theme | Business interfaces via `useServices()` |
| Framework | `src/framework/` | Composition root, providers, i18n, logging setup | all (it wires them) |

- **DI without a container.** Every service is an interface constructed in the
  single composition root `src/framework/composition/createServices.ts`, exposed
  through `ServicesProvider` / `useServices()`. Constructor injection only; tests
  override edges via `createServices({ jokesRepository: fake })`.
- **Two state paths (MVVM).** Fetched request/response data → React Query, with
  keys **only** from the `src/presentation/queryKeys.ts` factory (never ad-hoc
  arrays). Live domain state → an RxJS `BehaviorSubject` behind a service
  interface, read in the UI only through `src/presentation/hooks/useObservable.ts`
  — no RxJS operator pipelines in the UI; transformation belongs in the service.
- **Hooks are thin bindings**; heavy logic stays in plain-TS Access/Business units.
- **Operational gates, not routes.** Forced update and the kill switch expose an
  `Observable<boolean>`; `AppGate` swaps the whole tree (forced update wins over
  kill switch, auto-recovers). `DiagnosticsHost` mounts *outside* `AppGate`.
- **Restart-to-apply switches.** Environment selection and the real-vs-mock flag
  are persisted and resolved once at startup (`resolveMockingEnabled`) — never
  re-wire the live graph.
- **Vendor SDKs live behind seams** (`RemoteConfigProvider`, `AnalyticsSink`,
  `CrashReporter`, `AppReviewGateway`). Opt-in native SDKs (Firebase Remote
  Config, Bugsee) are loaded by a literal guarded `require` inside one gateway,
  reachable only from `src/framework/composition/platformIntegrations.ts`, so the
  default graph and base native build stay SDK-free.

`src/{access,business,presentation}/jokes/` (Dad Jokes) is the canonical vertical
slice — copy it; see [doc/DadJokes.md](../doc/DadJokes.md).

## Adding a feature `foo`

1. `src/access/foo/` — `FooRepository` interface + `HttpFooRepository` (axios
   from `createHttpClient` + a zod schema) + `MockFooRepository`.
2. `src/business/foo/` — `FooService` interface + `DefaultFooService` (plain TS,
   `BehaviorSubject` for live state, Access deps via constructor).
3. `src/presentation/foo/` — thin `useFoo` hook (`useServices()`, React Query,
   `useObservable`) + components built from the design-system base components.
4. Wire the real implementations in `createServices.ts` — the only wiring step.
5. Test Tier 1 (plain TS) + Tier 2 (`renderHook`/RTL), then run the verify loop.

Never introduce a DI container, and never move heavy logic into hooks.

## Conventions

- **TypeScript strict** (`expo/tsconfig.base`); no unjustified `any`.
- **Casing:** feature folders camelCase; components/screens/type/class/interface
  files PascalCase (`JokesScreen.tsx`, `JokesRepository.ts`); hooks and plain
  modules camelCase (`useJokes.ts`, `queryKeys.ts`). Naming: `FooRepository` /
  `HttpFooRepository` / `MockFooRepository`; `FooService` / `DefaultFooService`.
- **Never hand-edit or commit `android/` or `ios/`** — generated by
  `expo prebuild`, gitignored. No EAS Build, no `expo-updates`/OTA.
- **App config is `app.config.ts`**; features read `EnvironmentService.getConfig()`
  at runtime, never the config file.
- **Storage:** `KeyValueStore` (MMKV, synchronous) for plain data; `SecureStore`
  (expo-secure-store, async) for secrets only. Both interfaces with in-memory mocks.
- **Serialization:** every Access DTO is a zod `fooSchema` + `z.infer`; parse at
  the Access boundary only — fail loud on network payloads, fail soft on persisted.
- **Errors:** failures surface as the typed taxonomy in `src/access/http/errors.ts`;
  screens render fetched state through `QueryStateView`.
- **Logging:** inject the `Logger`; no `console.*` in app code except `ConsoleTransport`.
- **Navigation:** typed `RootStackParamList`; no string-literal route names
  outside the param lists; `navigationRef` for imperative navigation from services.
- **Theming:** colors/spacing/radii/typography come from `useTheme()` or the base
  components (`Screen`, `Card`, `AppText`, `Button`, `TextField`) — no inline hex,
  font sizes, or magic margins. Add a token instead of a one-off value.
- **Localization:** all user-facing copy through `t('key')` (lint-enforced on
  `src/presentation/**`); add every key to both `en.json` and `fr.json`.
- **Forms:** `react-hook-form` + zod resolver, schema as a `(t) => z.object(...)`
  builder for localized messages, fields bound with `Controller` to `TextField`.
- **Lint:** ESLint flat config on `eslint-config-expo` with Prettier as a rule;
  `react-hooks/exhaustive-deps` and `i18next/no-literal-string` are errors.
- **No vendor keys in the repo** (it is public): Firebase config files are
  gitignored (`.example` placeholders only), Bugsee tokens come from CI env vars
  through `extra.bugsee`.

## Testing

Three tiers — use the lowest that catches the bug. Tier 1: plain TS in Node
(services, RxJS streams, composition root). Tier 2: `@testing-library/react-native`
headless (`render`/`renderHook` are **async** in RNTL v14 — `await` them; flush
observable-driven presses inside `await act(async () => ...)`). Tier 3: Maestro
flows in `e2e/`, selectors are **`testID`s, never localized copy**.

- Suites live in `test/` (mirrors `src/`, examples in `test/examples/`) or
  co-located as `*.test.ts(x)`; headless operational flows in `test/integration/`.
- Fake the edges: **MSW** for network, `Mock*Repository`/fakes for data. Native
  modules are faked (MMKV via `moduleNameMapper`, safe-area via `jest.setup.js`).
- Tier-2 query clients: `new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })`.
- Tier-1 observable tests: subscribe → act → assert → **unsubscribe**.
- Restart-to-apply behavior is proven by building a second graph over a shared
  `KeyValueStore`.

## Repository housekeeping

- Commits must follow **Conventional Commits** (enforced by
  `.github/workflows/conventional-commits.yml`).
- Add a `doc/` page for every new cross-cutting concern, and keep the index in
  `doc/README.md` current.
