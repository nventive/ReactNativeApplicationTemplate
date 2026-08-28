# Findings that apply to this template repository

Filtered from the GardaPB external code review (`external-code-review/*.md`). Every entry below
was **verified against this repo's source** — findings that only exist in the generated app
(SQLite/db layer, speech/TTS, briefs, generate, ask, search, bookmarks, tickers, alerts, the
`--forceExit` flag, the stale deployment docs, the broken bundle-id comment, etc.) are excluded.
Review IDs (A-/B-/P-/F-/T-/D-) reference the original documents. The Dad Jokes sample stays in
the template by design — its findings are about *quality of the example*, not its existence.

---

## 1. Correctness

1. **[B-10] Gate streams have no error containment and no logger.**
   `src/business/forcedUpdate/DefaultForcedUpdateService.ts:30-34` and
   `src/business/killSwitch/DefaultKillSwitchService.ts:16-20` pipe through
   `shareReplay({ bufferSize: 1, refCount: false })` with no `catchError`. A source error
   terminates the shared stream for the app's lifetime and the gate silently freezes on
   `useObservable`'s fallback. These are also the only two services without an injected
   `Logger`, so there would be zero trace — on the two most safety-critical streams.
   *Fix: `catchError` → safe value (`false`) + inject a `Logger`.*

2. **[P-12] `useObservable` subscribes in a passive effect; `AppGate` uses constant `false` fallbacks.**
   `src/presentation/hooks/useObservable.ts:16-18` (via `observable-hooks`
   `useObservableState`) delivers the first real value only after the initial render commits.
   `src/presentation/shell/AppGate.tsx:28-29` passes constant `false` for both gates → at cold
   start one frame of app UI can paint behind an active kill switch / forced update. Callers are
   split: `useJokes.ts:25` and `AppGate` use constants; the diagnostics screens correctly pass
   synchronous getters. *Fix: standardize on sync getters as `initialValue` (add getters where
   missing) or make the bridge eager (`useObservableEagerState`).*

3. **[F-7] `detectLocale` only inspects the first device locale, contradicting its own docstring.**
   `src/framework/i18n/detectLocale.ts:11` reads `getLocales()[0]` only; the docstring promises
   picking from "the device's preferred locales". A device ordered `[de, fr]` gets the fallback
   (en) instead of fr. *Fix: walk `getLocales()` for the first supported language code.*

4. **[A-7] Log-file append is O(n²) and the file is unbounded.**
   `src/access/logger/ExpoFileSystemGateway.ts:26-29` re-reads and rewrites the whole file per
   line (acknowledged in the header comment); nothing caps or rotates `application.log`
   (the in-memory transport *is* capped at 300 — the file transport has no equivalent).
   *Fix: batch flushes in `FileTransport` (queue already exists) + add a size cap/rotation.*

5. **[A-12] `FirebaseRemoteConfigProvider` — unreachable `dispose()`, init/dispose race.**
   `src/access/remoteConfig/FirebaseRemoteConfigProvider.ts:46-85`: constructor ends with
   `void this.initialize()` which registers the real-time listener; `dispose()` (line 64) is not
   on the `RemoteConfigProvider` interface and has zero call sites; no `disposed` flag, so a
   dispose racing initialize leaves the listener registered. *Fix: explicit `start()` over
   constructor kick-off; guard with a `disposed` flag.*

6. **[A-16] Bugsee token validated trimmed but launched untrimmed.**
   `src/access/crashReporting/bugseeToken.ts:13-15` validates `token.trim()`, but the raw token
   flows to `BugseeCrashReporter` → `NativeBugseeGateway.launch(token)`. A CI-injected token
   with stray whitespace passes validation and then fails at launch. *Fix: trim once at the
   boundary.*

7. **[B-3] Jokes `favorites$` emits the mutable backing array.**
   `src/business/jokes/JokesService.ts:21` is `Observable<Joke[]>` (not `readonly Joke[]`), and
   `DefaultJokesService` emits the exact array reference the `BehaviorSubject` holds — a
   consumer can mutate live business state in place, and it gets persisted on the next toggle.
   The sample everyone copies is the one place modeling mutability. *Fix:
   `Observable<readonly Joke[]>` + `BehaviorSubject<readonly Joke[]>`.*

8. **[B-12] App-review signal counter carries over across versions and grows unboundedly.**
   `src/business/appReview/DefaultAppReviewService.ts:36-56`: the counter resets only after a
   *successful* prompt; the early returns (already prompted this version / gateway unavailable)
   keep the incremented count, so a user who ever crossed the threshold prompts on their first
   positive signal in every later version. *Fix: decide explicitly — reset per version, or
   document the carry-over in the interface JSDoc.*

9. **[B-16] `MockEnvironmentService.reset()` diverges from the real service (LSP).**
   `src/business/environment/MockEnvironmentService.ts:45-48` always clears `pending$`;
   `DefaultEnvironmentService.ts:61-65` raises a pending change when the current environment
   came from an override. The mock's own doc comment claims parity. *Fix: mirror the real
   computation (give the mock a `buildDefault`).*

10. **[F-10] iOS/Android build numbers diverge on malformed `APP_BUILD_NUMBER`.**
    `app.config.ts:62-64`: `"abc"` yields iOS `CFBundleVersion = "abc"` while Android falls back
    to `1` (which can collide with a published versionCode); `parseInt` also silently truncates
    `"12abc"` → 12, and `|| 1` maps a legitimate `0` to 1. *Fix: validate `/^\d+$/` once and
    throw.*

11. **[F-3 partial] Production Android store URL points at the internal package id.**
    `src/business/environment/environments.ts:59-60`: the production `appStoreUrl.android` uses
    `id=com.nventive.internal.reactnativeapptemplate` — after generation this becomes the
    *internal* app id, not the production one (`app.config.ts` production id drops `.internal.`).
    The forced-update CTA in production would open the wrong store page. *Fix: use the base
    (production) package id in the production entry.*

12. **[D-2] `Build_Staging` has no schedule guard — the nightly "security scan only" promise is unenforced.**
    `build/azure-pipelines.yml`: `Commit_Validation`, `Verify`, and `Template_Validation` carry
    `condition: ne(variables['Build.Reason'], 'Schedule')`; `Build_Staging` (lines 80-89) has no
    condition at all, so nightly behavior rests on Azure's skipped-dependency semantics. Worst
    case: full signed builds + Maestro + MobSF every night (and uploads, once a consumer enables
    distribution). *Fix: one-line schedule condition on `Build_Staging`.*

13. **[D-3] Audit-allowlist policy (reason + expires mandatory) is documented but not enforced.**
    `scripts/security-audit.mjs:114-127,168`: an entry with no `expires` suppresses forever
    (`if (entry.expires && ...)`), `reason` is display-only, and matching is first-entry-wins
    even when that entry is expired. The allowlist `_comment` and `doc/SecurityScan.md` both say
    reason + expiry are mandatory. *Fix: treat entries missing `reason`/`expires` as invalid
    (refuse to suppress, warn, non-zero in `--strict`); prefer a non-expired match.*

## 2. Architecture & conventions

14. **[Arch §2] Layer boundaries are not enforced in lint** — the review's top structural
    recommendation. `eslint.config.js` (42 lines) has no `import/no-restricted-paths`,
    `eslint-plugin-boundaries`, or `no-restricted-imports`; the architecture survives on
    discipline alone, and #15 shows the erosion pattern already exists here. *Fix: boundary
    zones in ESLint; allow type-only DTO imports Presentation→Access, forbid value imports.*

15. **[P-8] Four runtime Presentation→Access value imports (diagnostics).**
    `src/presentation/diagnostics/LogConsoleScreen.tsx:6,9` (`shouldLog`, `isNetworkLogEntry`)
    and `RemoteConfigSection.tsx:3-4` (`REMOTE_CONFIG_DEFAULTS`, `version`). *Fix: re-export
    through Business, or document diagnostics as an accepted exception — then enforce via #14.*

16. **[F-1 partial / F-9] The platform-integrations activation seam is dead code, and CLAUDE.md documents the opposite.**
    `src/app/App.tsx:20` calls bare `createServices()`; `platformIntegrationOverrides()`
    (`src/framework/composition/platformIntegrations.ts`) has zero importers, while CLAUDE.md:197
    says the app entry "imports [it] to activate". Related: `FIREBASE_ENABLED` (native side,
    `app.config.ts:83`) and the JS-side wiring are two uncoordinated switches with nothing
    validating agreement — `FIREBASE_ENABLED=true` today ships the native footprint while the JS
    graph silently serves `StaticRemoteConfigProvider`. *Fix: wire the overrides in the app
    entry (or fix CLAUDE.md to match reality), and gate/validate both switches from one place.*

17. **[F-12 partial] Composition-root purity: runtime side effect mid-wiring + constructor-launched async.**
    `createServices.ts:239` calls `crashReporter.setAttribute(...)` during wiring;
    `BugseeCrashReporter` launches Bugsee in its constructor and `FirebaseRemoteConfigProvider`
    kicks `void this.initialize()` — once vendor SDKs activate, construction order silently
    becomes I/O order. (Template scale is fine: 406 lines, 20 services.) *Fix (low priority):
    explicit `start(services)` step; prefer `start()` over constructor async.*

18. **[B-15 partial] Jokes and appReview services log without a category.**
    All `logger.*` calls in `DefaultJokesService` and `DefaultAppReviewService` pass no meta, so
    their entries are unfilterable in the in-app log console; `LOG_CATEGORY_KEY` exists but only
    the HTTP interceptors use it. (The hardcoded-`'category'`-literal part of the finding is
    app-only.) *Fix: `{ [LOG_CATEGORY_KEY]: 'jokes' | 'appReview' }` on service logs.*

19. **[A convention note] Test-double naming is inconsistent** — three prefixes for the same
    kind of recording/in-memory fake: `Mock*` (MockUrlLauncher, MockFileSharer, MockLogger, …),
    `InMemory*` (InMemoryAppReviewGateway, InMemoryKeyValueStore, …), `Recording*`
    (RecordingAnalyticsSink, RecordingCrashReporter). *Fix: pick one convention and document it.*

20. **[B-18 partial] `DiagnosticsService.disablePermanently()` returns a gratuitous `Promise`**
    for a synchronous body (`DefaultDiagnosticsService.ts:39-43`). (The review's
    "duplicates `setUserVisible(false)`" claim doesn't apply — that method is app-only.) Minor.

## 3. Sample-feature quality (the example newcomers copy)

21. **[P-19] `JokeListItem.tsx` violates the design-system and a11y conventions it should teach.**
    `src/presentation/jokes/JokeListItem.tsx:30-61`: bare `Text` with inline `fontSize: 24`
    (twice) instead of `AppText`/tokens, text-glyph icons (`♥`/`♡`/`›`), a `Pressable` nested
    inside a `Pressable`, and no `accessibilityLabel`/`accessibilityState` — favorite state is
    conveyed only by the glyph. Also #7 (mutable `favorites$`) lives in this slice. *Fix: bring
    the sample up to the conventions — it's the canonical copy-source.*

22. **[P-19] Buttons without `testID` on error/modal paths.**
    `src/presentation/components/QueryStateView.tsx:61` (Retry) and
    `src/presentation/navigation/ExampleModalScreen.tsx:23` (Close) — Maestro is testID-only, so
    error-path and modal flows can't tap them. *Fix: add testIDs.*

23. **[new — found during verification] Maestro flows use localized copy as selectors,**
    violating the template's own testID-only rule (stated in `e2e/README.md:44-45`):
    `e2e/flows/launch.yaml` asserts the text `'Dad Jokes'`; `navigate.yaml` uses
    `tapOn: 'Close'`. Also `doc/Testing.md:130-140` shows a paraphrased, non-verbatim excerpt of
    `favorite-joke.yaml`. *Fix: testID selectors (needs #22's Close testID); sync the doc
    excerpt.*

24. **[P-14 partial] Inline `fontWeight: '600'` overrides in `NetworkInspectorScreen.tsx:109,113`**
    — the only inline weight overrides in the layer, silently overriding the `caption` variant
    (`tokens.ts` caption is 400). The review's embedded-font premise doesn't apply here (no
    custom font), so this is a minor tokens-discipline nit. *Fix: add a `captionStrong` variant.*

## 4. Testing

25. **[T-4] No shared `renderWithProviders` helper — Tier-2 scaffolding is copy-pasted.**
    5 files construct their own `QueryClient` with the correctness-relevant
    `retry: false, gcTime: Infinity` options (`useJokes.test.tsx`, `favoriteFlow.test.tsx`,
    `RootNavigator.test.tsx`, `screenViewAnalytics.test.tsx`, `tier2-react-query-msw.test.tsx`);
    3 duplicate the `activeQueryClient` `afterEach`; 5 more hand-build provider subsets
    (and `RootNavigator.test.tsx`'s stack omits `ThemeProvider`, unlike its siblings). A new
    suite that forgets `gcTime: Infinity` reintroduces the GC-timer leak the comments warn
    about. In the generated app this grew to 15+ copies. *Fix: `test/helpers/renderWithProviders.tsx`
    owning the stack, QueryClient construction, and teardown.*

26. **[T-9] The MMKV-backed `KeyValueStore` wrapper is never tested.**
    `test/access/storage/KeyValueStore.test.ts` / `SecureStore.test.ts` exercise only the
    in-memory doubles; `MmkvKeyValueStore` has zero test importers even though the Node MMKV
    mock (`test/mocks/reactNativeMmkv.ts`, wired in `jest.config.js:31`) would let it run.
    *Fix: parameterize the contract suite with `describe.each` over both implementations.*

27. **[T-6 weak form] One real-clock race in the HTTP suite.**
    `test/access/http/httpClient.test.ts:34` sleeps 10 ms so concurrent 401s overlap the
    single-flight refresh — a starved CI worker can break the overlap. No suite in the repo uses
    fake timers. Low priority (the only other sleep is a benign `setTimeout(0)` flush).
    *Fix: deterministic coordination (deferred promise in the fake token provider) or fake timers.*

## 5. CI / delivery

28. **[D-8] Unpinned tool installs in CI paths, against the repo's own pin-everything policy.**
    `build/templates/deploy-firebase-app-distribution.yml:45` — `npm install -g firebase-tools`
    (no version, in a stage that holds a Google service-account credential);
    `maestro-test.yml:33` — unpinned `curl | bash`; `variables.yml:70-75` —
    `mobsfImageTag: 'latest'` (self-aware comment, but still the default). Meanwhile agent
    images, Xcode, Docker, Node, Java are all pinned. *Fix: `firebase-tools@<version>`, set
    `MAESTRO_VERSION`, digest-pin MobSF.*

29. **[D-9] iOS artifact bloat.** `build/templates/build-ios.yml:139-156` publishes the entire
    `$(Build.ArtifactStagingDirectory)` — the full `.xcarchive` (signed .app + dSYMs) alongside
    the `.ipa` — while every consumer (`deploy-testflight.yml:47`, `mobsf-scan.yml:61`) globs
    only `*.ipa`. *Fix: export to a subfolder and publish the .ipa (dSYMs separately if wanted).*

30. **[D-9] No dependency caching.** Zero `Cache@2` tasks under `build/`;
    `yarn install --frozen-lockfile` runs cold 6 times across 5 templates (including the macOS
    lane). *Fix: cache yarn/Gradle/CocoaPods.*

31. **[D-9] Repeated setup steps; Maestro template installs Node it never uses.**
    The `NodeTool@0` (+ yarn install) pair appears in 6 templates; `maestro-test.yml:15-18`
    installs Node but no subsequent step uses it. *Fix: factor a `setup-node-yarn.yml` steps
    template; drop Node from maestro-test.*

32. **[D-9] Deployment job names violate the stated `On<OS>_<Purpose>` convention.**
    `deploy-firebase-app-distribution.yml:31` (`Deploy_Android_Firebase_<env>`),
    `deploy-testflight.yml:27` (`Deploy_iOS_<env>`), `deploy-googleplay.yml:27`
    (`Deploy_Android_GooglePlay`) — every non-deployment job complies. *Fix: rename or amend the
    convention in `doc/AzurePipelines.md` and the pipeline header.*

33. **[D-9] `IsReleaseBranch` misnomer.** `build/variables.yml:60-62` equals `refs/heads/main`
    under a comment calling it "the release branch", while the PR trigger includes `release/*`
    branches that can never satisfy it. *Fix: align the branch model or the naming.*

34. **[D-9] Distribution stages don't depend on device tests.** The (commented-out) staging and
    production distribution stages depend only on their `Build_*` stage — a Maestro smoke
    failure would never stop an upload once a consumer enables them
    (`azure-pipelines.yml:188-206, 261-293`). *Fix: add the dependency, or a comment stating the
    independence is intentional.*

## 6. Documentation

35. **[D-7] `doc/Architecture.md:67-68` documents a React hooks → Zustand → MobX escalation ladder.**
    Neither library is installed, and the ladder licenses contributors to introduce two state
    libraries against the RxJS-BehaviorSubject convention everything else enforces. *Fix:
    rewrite to the real escalation (local hooks → observable Business services).*

36. **[D-10 partial] `doc/Environment.md:48-50` says `apiBaseUrl` points at "the public Dad
    Jokes API"** — the code points at Reddit (`environments.ts`); `doc/HTTP.md` and the
    `environments.ts` comment get it right. *Fix: one word.*

## 7. Project generator (root causes of the app-side doc-drift findings)

37. **[D-4/D-6 root cause] Dangling "project generator" references survive generation.**
    `cli/generate.ts` deletes `doc/ProjectGenerator.md`, `cli/`, `.github/` etc. and strips
    `template-only` marker blocks, but these references live outside any marker and ship in
    every generated app: `doc/AzurePipelines.md:371` ("rebranding … is the project generator's
    job"), `doc/AzurePipelines.md:479`, `e2e/README.md:52`, `e2e/flows/launch.yaml:7`,
    `build/variables.yml:44`. The deleted `.github/workflows/conventional-commits.yml` is also
    still referenced by `build/azure-pipelines.yml:46` and
    `build/templates/validate-commits.yml:4` in the generated output. *Fix: wrap in markers,
    reword to not reference the generator, or teach the generator to rewrite them.*

38. **[F-3 root cause] The generator leaves sample/placeholder production values untouched, with
    nothing flagging them.** No handling of `environments.ts` (`apiBaseUrl` = Reddit ×3 envs,
    `appStoreUrl.ios` = `id0000000000` ×3) or `DEFAULT_USER_AGENT = 'DadJokesApp/1.0.0'`
    (`createHttpClient.ts:24` — contains no template identifier, so substitution never touches
    it). The generated app shipped a dead App Store link on the forced-update screen and a
    `DadJokesApp` user agent in production. *Fix: include the user agent in identifier
    substitution (derive from app name/version), and have the generator emit a post-generation
    checklist (or TODO markers) for the placeholder URLs it cannot know.*

---

## Verified NOT applicable (checked, excluded)

- **F-2** — `app.config.ts` bundle-id comment matches the code here, and the generator derives
  the `.internal.` variant correctly; the mismatch was introduced in the generated app.
- **T-2/F-4** — no `jest --forceExit` here (`"test": "jest"`); no console suppression in
  `jest.setup.js`.
- **T-3/D-5** — all three Maestro flows exist and `e2e/README.md` describes them accurately.
- **T-8/T-10** — no module-scope service graphs or date captures in tests; the
  `favoriteFlow`/`RootNavigator` cross-reference is accurate.
- **P-5 (Snackbar), P-15 (dead components)** — no Snackbar/PlaceholderContent/ScreenHeader here.
- **D-1, D-4** — deployment stages genuinely ship commented out here; scheme names are correct.
- Everything touching the app's added features: SQLite/db (A-1…A-3, A-5, A-6, A-8…A-10, A-14,
  A-15, A-17, A-18, T-1), speech/audio (A-4, A-11, B-1, B-5, B-7, B-11, B-14, T-5), and the
  briefs/generate/ask/search/bookmarks/tickers/settings screens (B-2, B-4, B-6, B-8, B-9, B-13,
  B-17, P-1…P-4, P-6, P-7, P-9…P-11, P-13, P-16…P-18, F-6, T-7).
