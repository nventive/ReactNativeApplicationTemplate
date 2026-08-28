# React Native App Template

Instructions for contributors (and AI agents) working in this repository. These take
precedence over generic assumptions about how a React Native project is laid out.

## What this is

A production-oriented mobile app built with **React Native** and **TypeScript**
(Expo, with Continuous Native Generation). It ships a layered architecture,
MVVM-style state management, dependency injection through a composition root, a set
of cross-cutting concerns wired end to end, and a runnable sample feature so the app
starts from a working, tested baseline.

<!-- template-only:begin -->
This repository is the **template** those apps are generated from. Run `yarn generate`
to stamp out a new app — identifiers substituted, template-only scaffolding removed;
see [doc/ProjectGenerator.md](doc/ProjectGenerator.md).
<!-- template-only:end -->

## Architecture

The app is organized into layers, and within each layer code is grouped **by feature**:

- **Layered architecture**, code organized **by feature within each layer**:
  - **Access (DAL)** — API clients, local storage, native platform services,
    serializable data-transfer objects. Depends on nothing above it.
  - **Business** — business services and immutable entities that manipulate data
    from the Access layer. Exposed via interfaces.
  - **Presentation** — state management (MVVM), navigation, and the UI.
- **MVVM-style state management** — live business state lives in observable services
  (an RxJS `BehaviorSubject` behind a service interface) and reaches the UI through
  thin hooks; fetched request/response data goes through React Query.
- **Dependency injection** wires the layers together: services are declared as
  interfaces and constructed in a single composition root
  (`src/framework/composition/createServices.ts`) — there is no DI container.
- **Cross-cutting concerns** the app ships: environments/configuration,
  logging, a diagnostics overlay, forced update, kill switch, localization, HTTP,
  local storage, serialization, navigation, and automated testing.
- **A runnable sample feature** — the "Dad Jokes" app — demonstrates a full vertical
  slice through all layers so newcomers have a working example to copy.

See [doc/Architecture.md](doc/Architecture.md) for the full picture.

## Working guidelines

- **Keep the layer boundaries clean.** Access has no knowledge of Business or
  Presentation; Business has no knowledge of Presentation; UI talks to Business
  through interfaces, never directly to Access.
- **Follow the folder-by-feature convention** inside each layer (e.g. a `jokes`
  feature appears under Access, Business, and Presentation).
- **Every cross-cutting concern gets docs.** When you add one, add a matching page
  under `doc/`.
- **Prefer interfaces + a mock implementation** for data sources, so the app can run
  and be tested without a live backend.

## Adding a feature (the canonical recipe)

Every feature is a vertical slice shaped like the sample **Dad Jokes** feature, with
the same shape in each layer. Adding a feature `foo` means:

1. **Access** (`src/access/foo/`) — define the data contract as an **interface**
   (`FooRepository`), a real implementation (`HttpFooRepository` — axios + a **zod**
   schema for the DTO), and a **mock** (`MockFooRepository`).
2. **Business** (`src/business/foo/`) — a service **interface** (`FooService`) and a
   plain-TS implementation. Expose live state as an **RxJS** `Observable`
   (`BehaviorSubject` source of truth); take Access deps via the **constructor**.
3. **Presentation** (`src/presentation/foo/`) — a **thin hook** (`useFoo`) that reads
   services from `useServices()`, uses **React Query** for fetched data and
   **`useObservable`** for live state, plus the component(s) that render it (built
   from the design-system base components — `Screen`/`Card`/`AppText`/`Button`,
   [doc/DesignSystem.md](doc/DesignSystem.md)).
4. **Wire it** in `src/framework/composition/createServices.ts` — construct the real
   implementations and add them to the services graph. This is the only wiring step.
5. **Test it** — plain-TS tests for the Access/Business units (fastest), and
   `renderHook`/RTL for the hook. Fake the edges (MSW for network, the mock repository
   for data). Run `yarn typecheck && yarn lint && yarn test`.

Keep heavy logic in the plain-TS Access/Business units; the hook stays a thin binding.
Follow the guardrails and conventions below (strict types, zod at boundaries, a
`queryKeys` factory, typed navigation / i18n keys). Do **not** introduce a DI
container or move heavy logic into hooks.

## Documentation map

`doc/` holds **permanent** per-concern documentation — one page per concern (Logging,
Diagnostics, HTTP, and so on). [doc/README.md](doc/README.md) is the index, and
[doc/Architecture.md](doc/Architecture.md) is the best starting point.

## Conventions

Enforce these consistently.

- **Package manager: Yarn 1 (classic).** `yarn add <pkg>` / `yarn add -D <pkg>`,
  never `npm install`. Prefer `npx expo install <pkg>` for Expo/RN libraries so
  versions stay SDK-compatible.
- **TypeScript strict.** `tsconfig.json` extends `expo/tsconfig.base` with
  `strict: true`. No `any` escapes without justification.
- **Expo with Continuous Native Generation.** `android/` and `ios/` are generated
  by `expo prebuild` and gitignored — never hand-edit or commit them. **No EAS
  Build, no `expo-updates`/OTA.**
- **App config is `app.config.ts`** (TypeScript, not static JSON). Features never
  read it at runtime — they consume the runtime `EnvironmentService`.
- **Data flow (see [doc/Architecture.md](doc/Architecture.md)):** fetched
  request/response data goes through React Query with keys from the central
  [src/presentation/queryKeys.ts](src/presentation/queryKeys.ts) factory —
  never ad-hoc key arrays. Live business state is a `BehaviorSubject` behind a
  service interface, consumed only via the
  [src/presentation/hooks/useObservable.ts](src/presentation/hooks/useObservable.ts)
  bridge — no RxJS operator pipelines in the UI.
- **Folder & file casing:**
  - Feature folders are camelCase within each layer: `src/access/jokes/`,
    `src/business/forcedUpdate/`.
  - Components, screens, and type/class/interface files are PascalCase
    (`JokesScreen.tsx`, `JokesRepository.ts`); hooks and plain modules are
    camelCase (`useJokes.ts`, `queryKeys.ts`).
  - Naming pattern: `FooRepository` (interface) / `HttpFooRepository` /
    `MockFooRepository`; `FooService` (interface) / `DefaultFooService`.
- **Linting & formatting:** ESLint flat config (`eslint.config.js`) based on
  `eslint-config-expo`, with Prettier enforced as an ESLint rule
  (`eslint-plugin-prettier`). `react-hooks/exhaustive-deps` is an **error**
  (guardrail), and `i18next/no-literal-string` (`jsx-text-only`) is an **error**
  on `src/presentation/**`. Entry points: `yarn lint` / `yarn lint:fix`.
- **Testing:** Jest with the `jest-expo` preset. Tier 1 = plain TS in Node;
  Tier 2 = `@testing-library/react-native` (`render`/`renderHook`), headless;
  **MSW** fakes the network. Suites live in `test/` (examples under
  `test/examples/`) or co-located as `*.test.ts(x)`. `render`/`renderHook` are
  **async** (RNTL v14) — `await` them. Native modules absent in Node are faked:
  MMKV via a `moduleNameMapper` mock, safe-area-context via `jest.setup.js`, Expo
  modules by `jest-expo`; storage/logger tests use the in-memory implementations.

Cross-cutting conventions (see the matching `doc/` pages):

- **Storage:** `KeyValueStore` (MMKV, **synchronous**) for plain data;
  `SecureStore` (expo-secure-store, **async**) for secrets only. Both are
  interfaces with in-memory mocks, injected by constructor. See
  [doc/LocalStorage.md](doc/LocalStorage.md).
- **Serialization:** every Access DTO is a zod `fooSchema` + `z.infer` type;
  parse at the Access boundary only — fail loud on network payloads, fail soft on
  persisted ones. See [doc/Serialization.md](doc/Serialization.md).
- **Environments:** read `EnvironmentService.getConfig()`, never `app.config.ts`;
  switching is persisted and **applied on restart**. See
  [doc/Environment.md](doc/Environment.md).
- **Logging:** inject the `Logger`; **no `console.*` in app code** except
  `ConsoleTransport`. See [doc/Logging.md](doc/Logging.md).
- **HTTP & errors:** repositories take the shared axios instance from
  `createHttpClient` and parse responses with zod; failures surface as the typed
  taxonomy in `src/access/http/errors.ts`; screens render fetched state through
  `QueryStateView`. See [doc/HTTP.md](doc/HTTP.md), [doc/ErrorHandling.md](doc/ErrorHandling.md).
- **Navigation:** React Navigation with typed `RootStackParamList`; **no
  string-literal route names** outside the param lists;
  `navigationRef` for imperative navigation from services. See
  [doc/Navigation.md](doc/Navigation.md).
- **Design system / theming:** screens read colors, spacing, radii, and
  typography from the theme via `useTheme()` or the base components
  (`Screen`, `Card`, `AppText`, `Button`) in
  [src/presentation/theme/](src/presentation/theme) — **no inline hex colors,
  font sizes, or magic margins**. Add a token rather than a one-off value.
  Light/dark follows the OS by default (`ThemeProvider`). See
  [doc/DesignSystem.md](doc/DesignSystem.md).
- **Localization:** all user-facing copy goes through `t('key')` (enforced by the
  lint rule); keys are typed against `en.json`; add every key to both `en.json`
  and `fr.json`. See [doc/Localization.md](doc/Localization.md).

Operational conventions (see the matching `doc/` pages):

- **Remote config:** remote, server-controlled values are read through the
  `RemoteConfigProvider` interface (`values$` + `getValues()`), never a vendor
  SDK directly; typed `RemoteConfigValues` with safe defaults, parsed fail-soft.
  The controllable mock (`MockRemoteConfigProvider`) drives features with no
  backend. See [doc/RemoteConfig.md](doc/RemoteConfig.md).
- **Operational gates:** forced update and the kill switch are **observable
  gates**, not routes — business services expose an `Observable<boolean>` and
  `AppGate` (outside the navigator) swaps the whole tree, with **forced update >
  kill switch** precedence and automatic recovery when a flag clears. See
  [doc/ForcedUpdate.md](doc/ForcedUpdate.md), [doc/KillSwitch.md](doc/KillSwitch.md).
- **Diagnostics overlay:** the `DiagnosticsHost` is mounted **outside** `AppGate`
  (stays reachable during a block) and gated by
  `environment.getConfig().diagnosticsEnabled` (off in production) plus a
  persisted permanent-disable and a session dismiss. See
  [doc/Diagnostics.md](doc/Diagnostics.md).
- **Mocking toggle:** the real-vs-mock decision is a single persisted flag
  resolved once at startup by `resolveMockingEnabled` (mock in dev, real
  elsewhere) and applied **on restart** — never re-wire the live graph. It
  selects both the data repositories and the remote-config provider. See
  [doc/Diagnostics.md](doc/Diagnostics.md).
- **Analytics / vendor seams:** screen views and domain events go through the
  `AnalyticsSink` interface only (default = the logging no-op sink); swap a real
  provider at the composition root. This is the seam pattern for every vendor SDK
  (analytics, crash reporting). See [doc/Analytics.md](doc/Analytics.md).

Platform-integration conventions (see the matching `doc/` pages):

- **Opt-in vendor SDKs.** Firebase Remote Config and Bugsee are **not** default
  dependencies — the app ships (and prebuilds) without them. Each SDK is
  loaded by a **literal guarded `require`** inside a single native gateway
  (`FirebaseRemoteConfigGateway`, `NativeBugseeGateway`), reachable **only** from
  `src/framework/composition/platformIntegrations.ts`. The app entry always spreads
  `platformIntegrationOverrides()` into `createServices`; it probes each SDK and
  returns `{}` when neither is installed, so the default template graph is exactly
  the SDK-free one and the base bundle stays SDK-free (importing the seam is safe —
  the guarded `require` only runs on gateway construction). Installing an SDK lights
  up its factory. The composition root stays a **pure construction pass**: the
  explicit `startServices(services)` step (called once by the app entry) owns the
  runtime launches (Bugsee session, Firebase provider `start()`), the environment
  attribute, and a **loud warning when the Firebase native footprint
  (`FIREBASE_ENABLED`) and the JS SDK wiring disagree**. Add a new opt-in
  integration the same way (a gateway behind an interface + a `*Factory` override,
  launched from `startServices` if it needs one), never a bare SDK import in the
  default graph. See [doc/FirebaseRemoteConfig.md](doc/FirebaseRemoteConfig.md),
  [doc/CrashReporting.md](doc/CrashReporting.md).
- **No vendor keys in the repo (it is public).** Firebase config files are
  gitignored (commit only the `.example` placeholders) and CI-injects them per
  lane; the config plugin/`googleServicesFile` in `app.config.ts` are guarded by
  `FIREBASE_ENABLED`. Bugsee tokens come from CI-injected build env vars surfaced
  through `extra.bugsee` (empty in the repo and on production lanes), validated
  against `BUGSEE_TOKEN_FORMAT`. Never hardcode a key or token, and keep server
  secrets out of `extra` entirely.
- **Crash reporting is internal-builds-only.** Inject the `CrashReporter`
  interface (default `NoopCrashReporter` — production/store builds carry no SDK).
  `resolveCrashReporter` double-gates Bugsee: `crashReportingEnabled` is **false
  in production** (billed per user) **and** a valid token is required. Production
  crash reporting (Crashlytics) drops into the same seam per project. See
  [doc/CrashReporting.md](doc/CrashReporting.md).

Delivery conventions (see the matching `doc/` pages):

- **Three test tiers, lowest that catches the bug wins.** Tier 1 (plain TS) and
  Tier 2 (`renderHook`/RTL, headless) run in the verify loop; Tier 3 is
  **Maestro** smoke flows in [e2e/](e2e/) (`launch`/`navigate`/`favorite-joke`),
  human/CI-run only. Maestro **selectors are `testID`s, never localized copy** —
  add a `testID` (or `tabBarButtonTestID`) before referencing an element from a
  flow. Headless operational flows (env switch, forced update, kill switch,
  mocking toggle) live in `test/integration/`; restart-to-apply is proven by
  building a second graph over a **shared `KeyValueStore`**. `yarn test:coverage`
  reports coverage (a diagnostic, not a gate). See [doc/Testing.md](doc/Testing.md).
- **Security scan = two non-blocking scans.** (1) A dependency (SCA) audit,
  nightly: `yarn audit:scan` (`scripts/security-audit.mjs` over `yarn audit`);
  accept a residual advisory only in `security/audit-allowlist.json` **with a
  reason and an `expires` date** (expired entries re-surface). (2) **MobSF binary
  SAST** over the signed `.apk`/`.aab`/`.ipa` (`build/templates/mobsf-scan.yml`,
  the `Security_Scan_Staging`/`Security_Scan_Production` stages) — dockerized,
  publishes PDF + JSON reports, off-PR. Neither is ever a PR gate. See
  [doc/SecurityScan.md](doc/SecurityScan.md).
- **CI/CD is Azure Pipelines, `expo prebuild` + Gradle/Xcode, no EAS.** The
  delivery pipeline lives in [build/](build/): `azure-pipelines.yml` (stage graph,
  `PascalCase_With_Underscores` stages / `On<OS>_<Purpose>` jobs, `IsPullRequestBuild`
  gating), `variables.yml`, and step templates in `build/templates/`. **No debug
  builds** — the signed **staging (Release)** build is the PR gate (runs on every
  PR); release/deploy stages are gated off PRs. Signing is injected from Azure
  **secure files + variable groups** (Android via `android.injected.signing.*`,
  iOS via Apple cert/profile + `exportOptions.plist`) — never committed. The four
  **deployment stages** (Firebase App Distribution + TestFlight for staging;
  Google Play + App Store + Firebase for production) ship **commented out** — their
  templates exist but need service connections / environments a fresh clone lacks;
  enable per lane. Native, signing, and store configuration must be set up manually
  before the pipeline can run green — see [doc/AzurePipelines.md](doc/AzurePipelines.md).
- **App reviews go through the seam, prompted by policy.** In-app store review is
  `expo-store-review` behind `AppReviewGateway` (the sole SDK touchpoint), with the
  *when* — availability + rate-limiting (signal threshold, once per version,
  persisted) — in the `AppReviewService` Business layer. Call
  `useAppReview().requestReviewIfAppropriate()` only at a **genuinely positive
  moment**, never a failure path; never import `expo-store-review` outside the
  gateway. See [doc/AppReviews.md](doc/AppReviews.md).
- **Forms are `react-hook-form` + the `zod` resolver.** Build the schema as a
  `(t) => z.object(...)` **builder** so messages are localized; infer the value
  type from it; bind fields with `Controller` to the design-system `TextField`
  (never a bare `TextInput`); keep the submit thin (a Business call, not logic in
  the hook). The feedback modal is the reference example. See
  [doc/Forms.md](doc/Forms.md).

- **Verify loop:** `yarn typecheck && yarn lint && yarn test` must pass before
  proposing any change.
