# Remediation plan

Companion to [template-findings.md](template-findings.md) — finding numbers (#1–#38) reference
that document. The 38 findings are grouped into **11 work packages (WP1–WP11)**, each sized to be
one reviewable PR, ordered so correctness and cheap protection land first and structural /
quality work builds on them.

**Every WP ends with the verify loop:** `yarn typecheck && yarn lint && yarn test` (plus the
pipeline's own `Template_Validation` stage for CI-file changes, and `yarn generate --dry-run`
for generator changes).

Effort: **S** = under half a day · **M** = about a day · **L** = 2+ days.

## Summary

| WP | Title | Findings | Effort | Theme |
|---|---|---|---|---|
| 1 | Gate hardening & first-frame correctness | #1, #2 | M | User-facing correctness |
| 2 | Pipeline nightly guard & supply-chain pins | #12, #28, #34 | S | CI correctness/security |
| 3 | Audit-allowlist enforcement | #13 | S | Security tooling |
| 4 | Config correctness batch | #3, #10, #11, #36 | S | Config/i18n |
| 5 | Access-layer hardening ✅ | #4, #5, #6 | M | Durability |
| 6 | Business-layer batch | #7, #8, #9, #18, #20 | M | Contracts/consistency |
| 7 | Platform-integration seam & composition purity ✅ | #16, #17 | M | Structural |
| 8 | Layer-boundary enforcement in lint | #14, #15 | M | Structural (highest leverage) |
| 9 | Sample feature & design-system compliance | #21, #22, #23, #24 | M | Example quality |
| 10 | Test infrastructure | #19, #25, #26, #27 | M | Protection |
| 11 | Generator & docs sweep | #35, #37, #38 | M | Generation fidelity |

Rough total: **8–10 dev-days.** WP1–WP4 are independent of everything else and of each other —
they can land in any order or in parallel. WP8 should follow WP7 (the lint zones must reflect
the final platform-integration wiring). WP9/WP10 are independent quality work. WP11 last, so the
generator sweep picks up any doc/file moves made along the way.

## Decisions needed before (or during) the work

These are the only judgment calls; everything else is mechanical. Each has a recommendation the
plan assumes — override where noted and the WP adjusts.

1. **(WP1, #2) How to fix the first-frame flash.** Recommended: make the `useObservable` bridge
   eager (`useObservableEagerState` from `observable-hooks` — the gate streams emit
   synchronously on subscribe because their sources are BehaviorSubject-backed), **and**
   standardize sync getters as `initialValue` for services that have snapshots. Alternative:
   getters only (leaves any non-snapshot stream flashing).
2. **(WP6, #8) App-review counter semantics.** Recommended: reset the signal counter when the
   stored version differs from the current version (per-version threshold). Alternative: keep
   carry-over but document it in `AppReviewService`'s JSDoc as intended.
3. **(WP7, #16) Wire the seam or fix the docs.** Recommended: make `App.tsx` call
   `createServices(platformIntegrationOverrides())` so the documented activation path is real
   (it is a no-op while both SDK env vars are off). Alternative: keep bare `createServices()`
   and rewrite the CLAUDE.md / doc claims to say activation is a manual opt-in edit.
4. **(WP2, #34) Distribution vs device tests.** Recommended: add
   `dependsOn: [Build_Staging, DeviceTests_Staging]` to the commented-out staging distribution
   stage. Alternative: keep independence and add a comment stating it is intentional.
5. **(WP10, #19) Fake-naming rule.** Recommended: `Mock*` = controllable swap-in used by the app
   graph (repositories, providers, services); `InMemory*` = infrastructure double backed by
   memory; `Recording*` = spy that records calls. Rename the few outliers and state the rule in
   CLAUDE.md.

---

## WP1 — Gate hardening & first-frame correctness (M)

**Findings:** #1 (gate streams: no `catchError`, no logger), #2 (`useObservable` constant
fallbacks; kill-switch frame flash).

**Changes**
- `src/business/forcedUpdate/DefaultForcedUpdateService.ts`,
  `src/business/killSwitch/DefaultKillSwitchService.ts`: add `catchError` → emit `false` + log;
  inject `Logger` (new constructor arg); log with a `LOG_CATEGORY_KEY` category.
- `src/framework/composition/createServices.ts`: pass the logger to both services.
- `src/presentation/hooks/useObservable.ts`: per decision 1 — eager-read bridge (or add an
  `useObservableEager` sibling if any caller relies on lazy semantics).
- `src/presentation/shell/AppGate.tsx:28-29`, `src/presentation/jokes/useJokes.ts:25`: drop the
  constant fallbacks in favor of eager reads / sync getters; audit the remaining callers listed
  in finding #2 for consistency.

**Tests / acceptance**
- Tier-1: for each gate service, a throwing `values$` source results in `false` emissions (not a
  terminated stream) and a logged warning; recovery still works when the flag clears.
- Tier-2 (`test/presentation/shell/AppGate.test.tsx`): with the kill switch active at mount, the
  **first** render shows the kill-switch screen — no app-UI frame.
- Existing suites updated for the new constructor args.

## WP2 — Pipeline nightly guard & supply-chain pins (S)

**Findings:** #12 (no schedule guard on `Build_Staging`), #28 (unpinned tools), #34
(distribution ↛ device tests).

**Changes**
- `build/azure-pipelines.yml`: `condition: ne(variables['Build.Reason'], 'Schedule')` on
  `Build_Staging` (and confirm every stage other than `Security_Scan` is excluded on schedule —
  directly or transitively).
- `build/templates/deploy-firebase-app-distribution.yml:45`: `npm install -g firebase-tools@<pin>`.
- `build/templates/maestro-test.yml:33`: set `MAESTRO_VERSION` before the installer.
- `build/variables.yml:70-75`: pin `mobsfImageTag` to a version tag or `@sha256` digest (keep
  the "seam default" comment, updated).
- Per decision 4: dependency or intent comment on the commented-out distribution stages.

**Acceptance:** `Template_Validation` stage green; after merge, confirm one nightly run executes
only `Security_Scan`.

## WP3 — Audit-allowlist enforcement (S)

**Finding:** #13.

**Changes** — `scripts/security-audit.mjs`
- Treat an allowlist entry missing `reason` or `expires` as **invalid**: never suppress, print a
  loud warning, exit non-zero under `--strict`.
- Replace first-entry-wins with best-match: prefer a non-expired matching entry; only report
  "expired" when no valid entry matches.
- Sync the behavior description in `doc/SecurityScan.md` and the allowlist `_comment`.

**Tests / acceptance:** add a small Tier-1 suite for `matchAllowlist`/validation (export the
helpers if needed); cases: valid entry suppresses, missing-expires rejected, missing-reason
rejected, expired-then-valid ordering.

## WP4 — Config correctness batch (S)

**Findings:** #3 (detectLocale), #10 (build-number divergence), #11 (production store URL), #36
(Environment.md wording).

**Changes**
- `src/framework/i18n/detectLocale.ts`: walk `getLocales()` for the first supported
  `languageCode`; keep the fallback. Unit test: `[de, fr]` → `fr`; `[de]` → fallback.
- `app.config.ts:62-64`: validate `APP_BUILD_NUMBER` against `/^\d+$/` and **throw** on
  mismatch (config-eval time, so CI fails loud); drop the `|| 1` masking.
- `src/business/environment/environments.ts:59-60`: production Android store URL uses the base
  (non-`.internal.`) package id.
- `doc/Environment.md:48-50`: "the public Dad Jokes API" → "a Reddit endpoint used as the sample
  Dad Jokes API".

## WP5 — Access-layer hardening (M) — ✅ Done

**Findings:** #4 (log file O(n²)/unbounded), #5 (Firebase provider lifecycle), #6 (Bugsee token
trim).

**Status:** Done. `FileTransport` now buffers lines and drains one batched read-modify-write per
flush, capped at `DEFAULT_MAX_LOG_FILE_BYTES` (2 MiB, oldest whole lines dropped); the
`FileSystemGateway` was reduced to dumb `readAsString`/`writeString` I/O and the cap documented in
`doc/Logging.md`. `FirebaseRemoteConfigProvider` moved init off the constructor into an idempotent
`start()` (called by the wiring factory; WP7 will relocate it into `start(services)`) guarded by a
`disposed` flag so a dispose racing `configure` leaves no listener. The Bugsee token is normalized
once at the crash-reporting boundary (`normalizeBugseeToken` in `resolveCrashReporter`) so
validation and launch see the same trimmed string. Verify loop green (`yarn typecheck`, `yarn lint`
over `src`/`test`, `yarn test` 267/267); the pre-existing CRLF lint errors in `cli/generate.ts`
are untouched here and remain for WP11.

**Changes**
- `src/access/logger/FileTransport.ts` + `ExpoFileSystemGateway.ts`: batch queued lines into one
  append per flush; add a size cap (mirror the in-memory transport's capped design — e.g. check
  size on flush, truncate/rotate past a `MAX_LOG_FILE_BYTES`). Document the cap in
  `doc/Logging.md`.
- `src/access/remoteConfig/FirebaseRemoteConfigProvider.ts`: replace the constructor
  `void this.initialize()` with an explicit `start()`; add a `disposed` flag checked after every
  await; decide whether `dispose()` joins the `RemoteConfigProvider` interface or stays a
  provider-specific member invoked by the owner (`platformIntegrations.ts` — coordinate with
  WP7, which introduces the `start(services)` step that will call `start()`).
- `src/access/crashReporting/`: trim the token once at the boundary
  (`bugseeToken.ts` resolve/validate path) so validation and launch see the same string.

**Tests / acceptance:** FileTransport batching + cap over `InMemoryFileSystemGateway`
(existing suite extends); provider start/dispose race test (dispose during a pending `configure`
leaves no listener — extend `FirebaseRemoteConfigProvider.test.ts`); token-with-whitespace test
asserting the gateway receives the trimmed value.

## WP6 — Business-layer batch (M) — ✅ Done

**Findings:** #7 (mutable `favorites$`), #8 (app-review counter), #9 (mock env reset), #18 (log
categories), #20 (`disablePermanently` Promise).

**Changes**
- `src/business/jokes/JokesService.ts` + `DefaultJokesService.ts`:
  `Observable<readonly Joke[]>` / `BehaviorSubject<readonly Joke[]>`; fix any UI compile
  fallout (should be none — consumers only read).
- `src/business/appReview/DefaultAppReviewService.ts`: per decision 2 — compare stored
  `PROMPTED_VERSION_KEY` (or a new key) and reset the counter on version change; add a Tier-1
  test for the cross-version path.
- `src/business/environment/MockEnvironmentService.ts:45-48`: accept a `buildDefault` and mirror
  the real `reset()` pending computation; extend the environment suite with the
  reset-after-override case against **both** implementations.
- `DefaultJokesService` / `DefaultAppReviewService`: add
  `{ [LOG_CATEGORY_KEY]: 'jokes' | 'appReview' }` to every log call.
- `src/business/diagnostics/`: make `disablePermanently()` synchronous (`void`), or keep the
  Promise with a JSDoc reason — align the interface and implementation.

## WP7 — Platform-integration seam & composition purity (M) — ✅ Done

**Findings:** #16 (dead activation seam + uncoordinated Firebase switches + CLAUDE.md
contradiction), #17 (mid-wiring side effect, constructor async).

**Status:** Done. `App.tsx` now boots with `createServices(platformIntegrationOverrides())`
followed by a single `startServices(services)` call, so the documented activation path
is real. `platformIntegrationOverrides()` **probes each optional SDK** and returns `{}`
when neither is installed (proven by a Tier-1 test), so the default template graph is
byte-for-byte the SDK-free one and importing the seam pulls in no vendor code (the
gateways' guarded `require`s run only on construction). `app.config.ts` now surfaces
`extra.firebaseEnabled`, read via `getFirebaseEnabledNatively()`; the new pure
`checkPlatformIntegrationConsistency()` logs a loud `error` (category `platformIntegration`)
when the Firebase **native** footprint (`FIREBASE_ENABLED`) and the **JS** SDK wiring
disagree in either direction — mocking-independent (it keys off SDK availability, not the
resolved provider, so a dev build never false-alarms). The new `startServices.ts` owns
every runtime side effect that used to happen mid-wiring or in a constructor: it moves
`crashReporter.setAttribute('environment', …)` out of `createServices`, launches the
Bugsee session (`BugseeCrashReporter` constructor → idempotent `start()`), and starts the
Firebase provider (removed the `void provider.start()` kick from
`createFirebaseRemoteConfigProvider`), each via a duck-typed `Startable` guard that skips
the default no-op/mock/static implementations. `createServices` is now a pure construction
pass. Docs updated (`CLAUDE.md` platform-integration bullet, `doc/FirebaseRemoteConfig.md`,
`doc/CrashReporting.md`, `src/framework/README.md`). Verify loop green (`yarn typecheck`,
`yarn lint`, `yarn test` 288/288); the `CrashReporter` suite was updated for the deferred
launch and new Tier-1 suites cover the overrides/mismatch/start step.

**Changes** (per decision 3 — recommended path)
- `src/app/App.tsx`: `createServices(platformIntegrationOverrides())`.
- `src/framework/composition/platformIntegrations.ts`: detect and **warn loudly on mismatch**
  between native inclusion and JS wiring — e.g. `extra` carries a `firebaseEnabled` flag from
  `app.config.ts`, and the JS side logs an error when the flag and the resolved provider
  disagree (native footprint without JS wiring, or vice versa).
- `createServices.ts` / app entry: introduce an explicit `start(services)` step that owns the
  current hydrate kicks, `crashReporter.setAttribute(...)` (moved out of wiring), the
  remote-config provider `start()` from WP5, and the Bugsee launch (constructor → `start()`).
- Update `CLAUDE.md` (platform-integration bullet), `doc/FirebaseRemoteConfig.md`,
  `doc/CrashReporting.md` to match the final wiring.

**Tests / acceptance:** existing integration suites still pass (they build graphs directly);
add a Tier-1 test that `platformIntegrationOverrides()` returns `{}`-equivalent overrides when
both SDK gates are off, and the mismatch warning fires when told one side is on.

## WP8 — Layer-boundary enforcement in lint (M) — *after WP7*

**Findings:** #14 (no lint enforcement), #15 (diagnostics runtime imports).

**Changes**
- Resolve the four `src/presentation/diagnostics/*` runtime imports first: re-export
  `shouldLog` / `isNetworkLogEntry` / `REMOTE_CONFIG_DEFAULTS` / `version` through a Business
  module (the `speechText.ts` pattern the review cites), **or** declare diagnostics a documented
  exception and carve it out of the rule.
- `eslint.config.js`: add boundary zones — Access imports nothing above it; Business imports
  only Access; Presentation→Access allowed for **type-only** imports (enforce with
  `@typescript-eslint/consistent-type-imports` + a value-import restriction) with the sanctioned
  `access/http/errors` carve-out for `QueryStateView`.
- Add the rule to CLAUDE.md's conventions ("boundaries are lint-enforced").

**Acceptance:** `yarn lint` fails on a deliberate violation (spot-check locally, then revert);
zero violations in the tree.

## WP9 — Sample feature & design-system compliance (M)

**Findings:** #21 (JokeListItem), #22 (testIDs), #23 (Maestro selectors), #24 (captionStrong).

**Changes**
- `src/presentation/jokes/JokeListItem.tsx`: rebuild on the design system — `AppText`/tokens
  (no inline `fontSize`), a proper icon approach for ♥/♡/› (token-sized `AppText` variant or a
  vector icon if one is already a dependency — do not add a new dependency for this), flatten
  the nested pressables (row press + separate hit-slopped favorite control as siblings), add
  localized `accessibilityLabel` + `accessibilityState={{ selected: isFavorite }}`.
- `src/presentation/components/QueryStateView.tsx:61`: `testID="QueryRetryButton"`;
  `src/presentation/navigation/ExampleModalScreen.tsx:23`: `testID="CloseModalButton"`.
- `e2e/flows/launch.yaml`: replace the `'Dad Jokes'` copy assertion with a testID assertion;
  `navigate.yaml`: `tapOn: id: 'CloseModalButton'`.
- `src/presentation/theme/tokens.ts`: add `captionStrong` (600) and use it in
  `NetworkInspectorScreen.tsx:109,113` instead of inline `fontWeight`.
- `doc/Testing.md:130-140`: sync the `favorite-joke.yaml` excerpt with the real file.

**Tests / acceptance:** existing jokes suites updated for structure/labels (the
`useobservable-fireevent-act-flush` pattern applies to the favorite toggle); a11y assertions on
label + state; Maestro flows still pass on device (human/CI-run).

## WP10 — Test infrastructure (M)

**Findings:** #25 (shared render helper), #26 (MMKV contract), #27 (httpClient sleep), #19
(fake naming).

**Changes**
- `test/helpers/renderWithProviders.tsx`: `renderApp(ui, { services?, overrides? })` +
  `renderHookWithProviders`, owning the full provider stack, `QueryClient` construction
  (`retry: false`, `gcTime: Infinity` — keep the why-comments once, here), and `afterEach`
  teardown. Migrate the 10 hand-rolled setups; fix `RootNavigator.test.tsx`'s missing
  `ThemeProvider` for free. Document the helper in `doc/Testing.md` / `test/README.md`.
- `test/access/storage/`: convert both contract suites to `describe.each` over the in-memory
  and MMKV-backed implementations (the `test/mocks/reactNativeMmkv.ts` mapper already enables
  Node runs).
- `test/access/http/httpClient.test.ts:34`: replace the 10 ms sleep with deterministic
  coordination (a deferred promise in the fake token provider that the test resolves once both
  requests are in flight).
- Per decision 5: rename the outlier fakes and state the naming rule in CLAUDE.md.

## WP11 — Generator & docs sweep (M)

**Findings:** #35 (Zustand/MobX ladder), #37 (dangling generator references), #38 (placeholder
values).

**Changes**
- `doc/Architecture.md:67-68`: rewrite the escalation ladder to the real one (component-local
  hooks → observable Business service via `useObservable`); grep the doc set for any other
  Zustand/MobX mention.
- Dangling references (#37): wrap in `template-only` markers or reword so the sentence survives
  generation — `doc/AzurePipelines.md:371,479`, `e2e/README.md:52`, `e2e/flows/launch.yaml:7`,
  `build/variables.yml:44`; fix the `.github/workflows/conventional-commits.yml` citations in
  `build/azure-pipelines.yml:46` and `build/templates/validate-commits.yml:4` (markers, or
  reword since `.github/` is deleted on generation).
- Placeholders (#38): make `DEFAULT_USER_AGENT` derive from app identity/version (e.g. from
  `expo-constants` app name + version at client-creation time, or include the literal in
  `cli/generate.ts`'s identifier substitution); teach the generator to print a **post-generation
  checklist** naming what it cannot know: `environments.ts` `apiBaseUrl` (×3) and
  `appStoreUrl.ios` placeholder (×3), plus the Firebase/Bugsee lanes.
- Extend `cli/generate.test.ts`: generated output contains no "project generator" /
  `ProjectGenerator.md` / `.github/workflows` references and no `DadJokesApp` user agent;
  checklist output asserted.

**Acceptance:** `yarn generate --dry-run` clean; a real generation into a temp dir passes the
grep assertions above.

---

## Sequencing at a glance

```
WP1 (gates)      WP2 (CI)     WP3 (audit)    WP4 (config)     ← independent, land first
      │
WP5 (access) ── WP6 (business)                                ← hardening batches
      │
WP7 (seam & start()) ──► WP8 (lint boundaries)                ← structural; WP8 after WP7
      │
WP9 (sample quality)     WP10 (test infra)                    ← quality, independent
      │
WP11 (generator & docs)                                       ← last: sweeps up all moves
```

Each WP is one branch/PR (repo convention: `dev/<initials>/<topic>`), each ending with
`yarn typecheck && yarn lint && yarn test` green.
