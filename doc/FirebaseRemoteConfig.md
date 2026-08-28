# Firebase Remote Config

The real remote-config backend behind the [remote-config seam](RemoteConfig.md) —
`@react-native-firebase/remote-config`. It supplies the two server-controlled
values the operational features read: the forced-update minimum version and the
kill-switch flag.

Firebase is an **opt-in platform integration**: the app ships **without**
the SDK or any Firebase keys (this repo is public), runs against
[`StaticRemoteConfigProvider`](../src/access/remoteConfig/StaticRemoteConfigProvider.ts),
and prebuilds/boots clean. A project turns Firebase on with the steps below.

## How it fits the seam

Nothing above the Access boundary changes when Firebase is wired — forced update
and the kill switch consume [`RemoteConfigProvider`](../src/access/remoteConfig/RemoteConfigProvider.ts)
exactly as before. Two new files implement it:

| File | Role |
|------|------|
| [`FirebaseRemoteConfigProvider`](../src/access/remoteConfig/FirebaseRemoteConfigProvider.ts) | The `RemoteConfigProvider`. Seeds `REMOTE_CONFIG_DEFAULTS`, applies defaults + fetch settings, `fetchAndActivate`, listens for real-time updates, and maps the wire payload with `toRemoteConfigValues` (fail-soft). Pure — takes a gateway by constructor, so it is Tier-1 tested with a fake. |
| [`FirebaseRemoteConfigGateway`](../src/access/remoteConfig/FirebaseRemoteConfigGateway.ts) | The **only** file that imports the Firebase SDK, wrapping it behind [`RemoteConfigGateway`](../src/access/remoteConfig/RemoteConfigGateway.ts). Loads the SDK lazily; `isAvailable` is `false` when the package is absent. |

The wire keys ([`REMOTE_CONFIG_KEYS`](../src/access/remoteConfig/RemoteConfig.ts)) are:

| Remote key | Type | Typed as | Default |
|------------|------|----------|---------|
| `minimum_version` | string | `minimumVersion: Version` | `1.0.0` |
| `is_kill_switch_active` | bool | `killSwitchActive: boolean` | `false` |

The defaults are seeded both in-app (via `setDefaults`) and as the provider's
`BehaviorSubject` seed, so the gates never block before the first fetch resolves.
Set these two keys (and their values) in the Firebase console.

## Wiring (opt-in, keeps the default bundle SDK-free)

**The wiring is already in place** — no code edit is needed to activate. The app
entry always spreads the opt-in overrides into `createServices`:

```ts
// src/app/App.tsx (already wired)
const services = createServices(platformIntegrationOverrides());
startServices(services);
```

[`platformIntegrationOverrides()`](../src/framework/composition/platformIntegrations.ts)
**probes for the SDK**: with `@react-native-firebase/remote-config` absent (the
default template) it returns `{}`, so the graph is exactly the SDK-free one and
importing the seam pulls in no Firebase code (the guarded `require` only runs on
gateway construction). Once the package is installed, the override appears and
`createServices` uses `FirebaseRemoteConfigProvider` on the non-mock path (when
mocking is on, the controllable mock still wins so the diagnostics triggers work).

The provider is **started by [`startServices`](../src/framework/composition/startServices.ts)**,
not on construction — the composition root stays a pure construction pass.
`startServices` also **warns loudly when the two Firebase switches disagree**: the
native footprint (`FIREBASE_ENABLED`) and the JS SDK. Native config with no JS SDK
installed silently serves defaults; a wired JS SDK with no native app fails every
fetch — either logs an error at startup so the misconfiguration surfaces.

Per-environment fetch cadence comes from
[`EnvironmentConfig.remoteConfig.fetchIntervalMinutes`](../src/business/environment/EnvironmentService.ts)
— short in dev/staging, 12 h in production.

## Activation steps

1. **Install the SDK** (Expo-compatible versions):
   ```bash
   npx expo install @react-native-firebase/app @react-native-firebase/remote-config expo-build-properties
   ```
2. **Add the native config files** (see *Secrets* below) at the repo root:
   `google-services.json` (Android) and `GoogleService-Info.plist` (iOS).
3. **Enable it at build time** so `app.config.ts` wires the config plugin and the
   `googleServicesFile` paths (and surfaces `extra.firebaseEnabled` so the wiring
   guard can confirm the JS SDK matches):
   ```bash
   FIREBASE_ENABLED=true npx expo prebuild   # use cross-env on Windows / a CI variable
   ```
4. Create the `minimum_version` / `is_kill_switch_active` keys in the Firebase
   console and confirm forced update / kill switch respond on a dev build.

No `App.tsx` edit is needed — the seam is already wired (see above). If you install
the SDK **without** setting `FIREBASE_ENABLED` (or vice versa), `startServices`
logs an error at startup naming the missing half.

## Secrets — keys are never committed

This repo is public, so **no Firebase config is checked in**. The strategy:

- The real `google-services.json` / `GoogleService-Info.plist` are **gitignored**;
  only the [`google-services.json.example`](../google-services.json.example) and
  [`GoogleService-Info.plist.example`](../GoogleService-Info.plist.example)
  placeholders are committed.
- `app.config.ts` references the real files **only when `FIREBASE_ENABLED=true`**,
  so a clean clone prebuilds without them.
- **CI injects** the real per-lane files before `expo prebuild` (Azure DevOps
  secure files / secret variables → write to the repo paths). Point staging/
  internal and production lanes at different Firebase projects by injecting
  different files. See [AzurePipelines.md](AzurePipelines.md).

> Note on Firebase API keys: Firebase [documents](https://firebase.google.com/docs/projects/api-keys)
> that its API keys are not secrets (they identify the project; access is governed
> by Security Rules / App Check). We nonetheless keep them out of this public repo
> as a policy choice, using placeholders + CI injection instead.

## Scope

**In scope:** the two remote keys, in-app defaults, `fetchAndActivate` + real-time
updates, fail-soft mapping, and per-environment fetch interval.

**Out of scope:** RN reads the native `google-services.json` /
`GoogleService-Info.plist` directly, so there is no generated options file to
manage; Firebase project selection is a build-time file swap (CI), not runtime
code branching. Firebase Analytics and Crashlytics are separate concerns
([Analytics.md](Analytics.md), [CrashReporting.md](CrashReporting.md)).

## Testing

The provider/gateway seam is covered by Tier-1 tests
([`FirebaseRemoteConfigProvider.test.ts`](../test/access/remoteConfig/FirebaseRemoteConfigProvider.test.ts),
[`FirebaseRemoteConfigGateway.test.ts`](../test/access/remoteConfig/FirebaseRemoteConfigGateway.test.ts)).
The native config-plugin setup and the end-to-end console → device flow must be
verified on a real build with Firebase enabled.
