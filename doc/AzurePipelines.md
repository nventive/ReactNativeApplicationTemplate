# Azure Pipelines

CI/CD for this template runs on **Azure Pipelines**. **EAS Build is not used**:
native builds run `expo prebuild` to generate the `android/` and `ios/` projects,
then build with **Gradle** and **Xcode** directly on the build agents.

This page covers the full delivery pipeline: the PR gate, signed
staging/production builds, internal distribution (Firebase App Distribution +
TestFlight) and store publishing (Google Play + App Store), Maestro device
tests, and the nightly security scan.

There are **no debug builds** — the single signed **staging (Release)** build is
what validates every PR: one build configuration, exercised everywhere.

> **⚠ Setup required:** signing and native build configuration must be set up
> before this pipeline can run. The signed-build and device-test stages need a
> **one-time Azure DevOps setup** (variable groups + secure files) before their
> first run — see
> [One-time Azure DevOps setup](#one-time-azure-devops-setup-manual-steps).

## Pipeline definition

[`build/azure-pipelines.yml`](../build/azure-pipelines.yml) is the entry point;
shared variables live in [`build/variables.yml`](../build/variables.yml) and the
reusable steps in [`build/templates/`](../build/templates). Conventions: stages
`PascalCase_With_Underscores`, jobs `On<OS>_<Purpose>`, steps factored into
templates.

**Triggers**

- CI on `main`.
- PR validation for `main`, `release/*`, and `feature/*`.
- A **nightly schedule** (06:00 UTC) that runs only the security scan.

**What runs on a PR** — commit-message validation (`Commit_Validation`,
Conventional Commits), the verify loop (`Verify`, typecheck + lint + test +
coverage) **and** the signed `Build_Staging` build. That staging build *is* the
PR's build validation — there is no separate debug build. Everything downstream
(device tests, distribution, production, store publishing) is skipped on PRs via
the `IsPullRequestBuild` variable (`$[eq(variables['Build.Reason'], 'PullRequest')]`);
`IsReleaseBranch` further restricts production to `main`.

> Because `Build_Staging` is signed, PR builds consume the signing variable
> groups + secure files. Azure exposes those to PRs from **branches in this
> repo**, but **not to PRs from forks** — a fork PR's `Build_Staging` will fail
> at the signing step until a maintainer runs it. If you
> need fork PRs to validate without secrets, gate the signing inputs on the secret
> being present, or add an unsigned Release compile job for that case.

## Stages

| Stage | Runs when | Agent(s) | What it does |
|-------|-----------|----------|--------------|
| `Commit_Validation` | every PR & commit (not the schedule) | ubuntu | Enforces **Conventional Commits** on PR builds (`templates/validate-commits.yml`); the Azure Repos counterpart to the GitHub `conventional-commits` action. The step is PR-only, so it's a trivial success on CI/`main` builds. |
| `Verify` | every PR & commit (not the schedule) | ubuntu | The verify loop (`templates/verify.yml`: typecheck + lint + test). Fast, no secrets. Publishes JUnit test results + Cobertura coverage (diagnostic, never a gate). |
| `Build_Staging` | **every PR & commit** | ubuntu + macOS | The PR build gate. **Signed** staging `.apk` (Android) + `.ipa` (iOS), `APP_ENV=staging`, internal Firebase + Bugsee. Publishes `Android_Staging` / `iOS_Staging`. Release config — no debug build. |
| `DeviceTests_Staging` | not a PR | ubuntu (emulator) | Maestro smoke flows (`e2e/`) against the staging `.apk` (`templates/maestro-test.yml`). |
| `FirebaseDistribution_TestFlight_Staging` † | not a PR | ubuntu + macOS | Android → Firebase App Distribution, iOS → TestFlight. Internal distribution of the staging build. |
| `Build_Production` | not a PR **and** on `main` | ubuntu + macOS | **Signed** production `.aab` (Play) and `.ipa` (App Store), `APP_ENV=production`, production Firebase, **no Bugsee**. Publishes `Android_Production` / `iOS_Production`. |
| `GooglePlay` † | not a PR **and** on `main` | ubuntu | Publishes the production `.aab` to the Google Play **internal** track. |
| `AppStore` † | not a PR **and** on `main` | macOS | Uploads the production `.ipa` to App Store Connect (**TestFlight**). |
| `FirebaseDistribution_Production` † | not a PR **and** on `main` | ubuntu | Distributes the production build via Firebase App Distribution (needs an `.apk` — set `Build_Production` to `artifactFormat: both`). |
| `Security_Scan` | nightly schedule only | ubuntu | Non-blocking dependency audit (`templates/security-audit.yml`); publishes `Security_Report`. See [SecurityScan.md](SecurityScan.md). |

† **Ships commented out.** The four deployment stages need service connections,
secure files, and Pipelines Environments that don't exist in a fresh clone, so
they are disabled by default (the same way Firebase config is handled). Their
templates live in [`build/templates/`](../build/templates); enable a stage by
uncommenting its block — see [Deployment stages](#deployment-stages) and
[Enabling deployment](#enabling-deployment).

The generated `android/` and `ios/` folders are gitignored (Continuous Native
Generation) — CI always builds them fresh from `app.config.ts`, so config drift
is caught on every commit.

<!-- template-only:begin -->

## Template-validation stage

`Template_Validation` is an extra stage in `azure-pipelines.yml` (steps in
[`build/templates/template-validation.yml`](../build/templates/template-validation.yml))
that validates the [project generator](ProjectGenerator.md) rather than the app.
The rest of the pipeline always builds the template *as-is* — `cli/` present,
identifiers un-substituted — so it never exercises what the generator actually
does: substitute the app identifiers across every file, delete `cli/` + the
governance files, and un-wire its own hooks from `package.json` /
`jest.config.js`. A regression there (say a `package.json` edit that stops the
un-wire regex matching) would ship broken in **every freshly generated app**
while the template's own CI stayed green.

The stage closes that gap. It `dependsOn: Verify` and — on every PR and `main`
build, but not the nightly schedule:

1. Copies the checkout to a throwaway `GeneratedApp` dir (excluding
   `node_modules`, `android/`, `ios/`, …).
2. Runs the generator against the copy
   (`node cli/index.ts --name "Generated App" --bundle-id com.nventive.generatedapp --dir …`).
3. Runs the generated app's **own** verify loop — `yarn install --frozen-lockfile`,
   then `yarn typecheck && yarn lint && yarn test` — with `cli/` gone, proving
   the un-wiring left the project sound.
4. Runs `expo prebuild --platform android` on the **renamed** `app.config.ts` and
   compiles it with `./gradlew :app:assembleRelease`.

**Android only, unsigned, no secrets.** The main pipeline already proves the
template compiles on both platforms; the delta the generator introduces is in
the JS/TS + config layer, so one native compile is enough to catch a rename that
breaks `expo prebuild` or Gradle. Android is the secret-free platform — Expo's
generated release buildType signs with the auto-generated debug keystore — so the
stage needs no variable groups or secure files and even validates fork PRs. Add
`Template_Validation` to the `main` branch policy (alongside `Commit_Validation`,
`Verify`, `Build_Staging`) so a generator regression blocks the PR.

**It exists only in the template repo.** `yarn generate` strips the whole stage
from `azure-pipelines.yml` — the `template-only:begin`…`template-only:end`
markers around it, via `stripTemplateOnlyBlocks` in
[cli/generate.ts](../cli/generate.ts) — deletes the steps template (listed in
`TEMPLATE_ONLY_PATHS`), and scrubs this very section from the doc, so a generated
app carries none of it. The generator strips it with `template-only` marker blocks
because it edits files directly rather than running a template engine.

<!-- template-only:end -->


## Signing

No EAS, no committed keys — signing material comes from Azure DevOps **secure
files** and **variable groups**, injected at build time.

**Android** (`templates/build-android.yml`) — the keystore is a secure file and
signing is passed on the Gradle command line via `android.injected.signing.*`,
so the generated `build.gradle` is never hand-edited:

```
./gradlew :app:bundleRelease \
  -Pandroid.injected.signing.store.file="$(androidKeystore.secureFilePath)" \
  -Pandroid.injected.signing.store.password="$(AndroidSigningStorePassword)" \
  -Pandroid.injected.signing.key.alias="$(AndroidSigningKeyAlias)" \
  -Pandroid.injected.signing.key.password="$(AndroidSigningKeyPassword)"
```

`bundleRelease` produces the `.aab` (production/Play); `assembleRelease`
produces the `.apk` (staging/App Distribution/sideload).

**iOS** (`templates/build-ios.yml`) — `InstallAppleCertificate@2` +
`InstallAppleProvisioningProfile@1` install the `.p12` and profile from secure
files (manual signing), then `xcodebuild archive` + `xcodebuild -exportArchive`
export the `.ipa` using the lane's `exportOptions.plist` secure file. The cert
task passes `opensslPkcsArgs: -legacy` because Keychain-exported `.p12` files use
legacy PKCS#12 encryption (RC2-40-CBC) that OpenSSL 3 (on the `macOS-26` image)
rejects by default.

## Per-environment build profiles

There is no `eas.json`; a "build profile" is the set of env vars + secure files +
variable groups a lane injects. Two lanes:

| | Staging (internal) | Production |
|-|---------|------------|
| `APP_ENV` | `staging` | `production` |
| Android artifact | `.apk` | `.aab` |
| Keystore secure file | `com.nventive.internal.reactnativeapptemplate.jks` | `com.nventive.reactnativeapptemplate.jks` |
| Android var group | `…Distribution.Internal.Android` | `…Distribution.GooglePlay` |
| iOS cert / profile / export | `nventive.p12` / `com.nventive.internal.reactnativeapptemplate.mobileprovision` / `…exportOptions.plist` | `nventive.p12` / `com.nventive.reactnativeapptemplate.mobileprovision` / `…exportOptions.plist` |
| iOS var group | `…Distribution.Internal.iOS` | `…Distribution.AppStore` |
| Firebase config *(optional — off by default)* | `google-services-reactnative-internal.json` / `GoogleService-Info-reactnative-internal.plist` | `google-services-reactnative.json` / `GoogleService-Info-reactnative.plist` |
| Bugsee | token injected (internal build) | **omitted** — dormant on store builds |

`APP_ENV` selects the build-default environment in `app.config.ts`. The Bugsee
token flows into `extra.bugsee` and is **absent** on production so the GUID check
fails and Bugsee never launches ([CrashReporting.md](CrashReporting.md)). The
secure-file/variable-group names above are placeholders you set during the
one-time setup.

**Firebase is optional and off by default.** In `build/azure-pipelines.yml` the
`firebaseAndroidSecureFile` / `firebaseIosSecureFile` lines are **commented out**,
so the pipeline builds Firebase-free (no `FIREBASE_ENABLED`, no
`googleServicesFile`, a clean `expo prebuild`) — matching the base template, where
Firebase is opt-in. The **presence of the secure-file name is the only switch**:
uncomment the line (and upload the file) to turn Firebase on for that build; there
is no separate flag to keep in sync. See [Enabling Firebase](#enabling-firebase).

## Versioning

The app version is **derived from the Git history** with
[GitVersion](https://gitversion.net/), not hand-maintained. Each build job
computes it before `expo prebuild` and injects it as env vars that
[`app.config.ts`](../app.config.ts) reads:

| GitVersion output | Pipeline variable | `expo prebuild` env | `app.config.ts` | Native field |
|-------------------|-------------------|---------------------|-----------------|--------------|
| `MajorMinorPatch` (e.g. `1.0.0`) | `$(MajorMinorPatch)` | `APP_VERSION` | `version` | iOS `CFBundleShortVersionString` / Android `versionName` |
| `PreReleaseNumber` + `BuildPadding` | `$(BuildNumber)` | `APP_BUILD_NUMBER` | `ios.buildNumber` / `android.versionCode` | iOS `CFBundleVersion` / Android `versionCode` |

- [`build/gitversion-config.yml`](../build/gitversion-config.yml) — GitVersion
  config: `ContinuousDeployment` mode, `next-version: 1.0.0`, `main` tagged `dev`
  with `increment: none`. So `main` produces `1.0.0` with a `PreReleaseNumber`
  that climbs one per commit — a monotonic build number without manual bumps. To
  cut a `1.1.0`, bump `next-version` (or tag the release).
- [`build/templates/gitversion.yml`](../build/templates/gitversion.yml) —
  installs GitVersion (`5.12.0`) and runs it, exposing `$(MajorMinorPatch)` /
  `$(PreReleaseNumber)` to the rest of the job.
- [`build/templates/build-number.yml`](../build/templates/build-number.yml) —
  sets `$(BuildNumber)` = `PreReleaseNumber` + `BuildPadding`.
- **`BuildPadding`** ([`variables.yml`](../build/variables.yml), default `0`) — a
  one-time offset. Bump it once if a store already holds a higher build number
  than a fresh version stream would produce, so new uploads keep climbing.

Both `build-android.yml` and `build-ios.yml` include the two templates (each job
runs on its own agent, so each computes its own version) and **check out with
`fetchDepth: 0`** — GitVersion needs the full history and fails on a shallow
clone. A local `expo prebuild` without these env vars falls back to `version`
`1.0.0` / build number `1` in `app.config.ts`, so nothing GitVersion-specific is
needed to build off-CI.

## Artifact publishing

Each signed build publishes to a per-lane, per-platform artifact
(`Android_Staging`, `iOS_Staging`, `Android_Production`, `iOS_Production`) so a
later deploy stage can download just what it needs. The device-test stage and the
distribution stages download `Android_Staging`; the store/TestFlight stages
download the production artifacts; the security scan publishes `Security_Report`
(the JSON audit report).

Firebase App Distribution needs an `.apk` while Google Play needs an `.aab`, so
`build-android.yml` accepts `artifactFormat: apk | aab | both`. Staging builds an
`.apk` (feeds device tests + Firebase distribution); production builds an `.aab`
(feeds Play). To *also* distribute the production build over Firebase, set
`Build_Production` to `artifactFormat: both` so the one `Android_Production`
artifact carries both files.

## Deployment stages

The four deployment stages cover the full release topology. They are **deployment
jobs** (`environment:` + `runOnce/deploy`), so each maps to a Pipelines
**Environment** where you can attach approvals/checks. All four **ship commented
out** in `azure-pipelines.yml` — their templates exist, but a fresh clone has none
of the credentials they need, so they stay off until you
[enable deployment](#enabling-deployment).

| Stage | Template | Task | Target |
|-------|----------|------|--------|
| `FirebaseDistribution_TestFlight_Staging` | `deploy-firebase-app-distribution.yml` + `deploy-testflight.yml` | `firebase appdistribution:distribute` (CLI) / `AppStoreRelease@1` | Internal testers (Android) + TestFlight (iOS), from the **staging** build |
| `GooglePlay` | `deploy-googleplay.yml` | `GooglePlayRelease@4` | Play **internal** track, from the **production** `.aab` |
| `AppStore` | `deploy-testflight.yml` | `AppStoreRelease@1` | **TestFlight**, from the **production** `.ipa` |
| `FirebaseDistribution_Production` | `deploy-firebase-app-distribution.yml` | `firebase appdistribution:distribute` (CLI) | Internal testers, from the **production** `.apk` |

Both store tasks stop at their **internal/TestFlight** track — promotion to a
public release stays a manual, human-gated step in the Play Console / App Store
Connect. `AppStoreRelease@1` needs the **Apple App Store** Azure DevOps extension;
`GooglePlayRelease@4` needs the **Google Play** extension.

## Device tests (Maestro)

`DeviceTests_Staging` (`templates/maestro-test.yml`) downloads the staging
`.apk`, installs Maestro, boots a headless Android emulator, installs the app,
and runs `maestro test --include-tags smoke e2e/`, publishing JUnit results. The
flows live in [`e2e/`](../e2e/README.md). The emulator needs a
nested-virtualization-capable agent (KVM) or a self-hosted / macOS agent — set
this up before enabling the stage.

## Azure DevOps Library reference

The exact names the pipeline consumes. Add **only** these — the templates read
nothing else. (Names are the template-parameter values in
`build/azure-pipelines.yml` and the `$(...)` macros in `build/templates/*`; to
use your own names, change them there — one place per lane.)

### Variable groups (Pipelines → Library → Variable groups)

Create four signing groups plus the Bugsee group. The **staging** and
**production** groups of each platform hold the **same variable names** with
different values, so the build templates stay lane-agnostic — the linked group
supplies the right value per stage.

| Variable group | Linked to | Variable | Secret? | Read as |
|----------------|-----------|----------|:-------:|---------|
| `ReactNativeApplicationTemplate.Distribution.Internal.Android` | `Build_Staging` | `AndroidSigningStorePassword` | ✅ | `$(AndroidSigningStorePassword)` |
| " | " | `AndroidSigningKeyAlias` | — | `$(AndroidSigningKeyAlias)` |
| " | " | `AndroidSigningKeyPassword` | ✅ | `$(AndroidSigningKeyPassword)` |
| `ReactNativeApplicationTemplate.Distribution.GooglePlay` | `Build_Production` | *same three variable names* | | (as above) |
| `ReactNativeApplicationTemplate.Distribution.Internal.iOS` | `Build_Staging` | `AppleCertificatePassword` | ✅ | `$(AppleCertificatePassword)` |
| `ReactNativeApplicationTemplate.Distribution.AppStore` | `Build_Production` | *same variable* | | (as above) |
| `ReactNativeApplicationTemplate.Bugsee.Tokens` | `Build_Staging` **only** | `BugseeAndroidToken` | ✅ | `$(BugseeAndroidToken)` |
| " | " | `BugseeIosToken` | ✅ | `$(BugseeIosToken)` |

- Two iOS signing values are **not variables** — the install tasks output them,
  so you don't look them up: the **signing identity** (the cert's CN, e.g.
  `Apple Distribution: Acme Inc (TEAMID)`) from `InstallAppleCertificate@2`
  (`$(appleCert.signingIdentity)`), and the **provisioning-profile UUID** from
  `InstallAppleProvisioningProfile@1` (`$(provProfile.provisioningProfileUuid)`),
  which is passed straight to `PROVISIONING_PROFILE_SPECIFIER`. You supply only
  the cert password (above) plus the cert/profile *files* (below) — there is no
  profile-name variable to keep in sync with the portal.
- Link the **Bugsee group to `Build_Staging` only** — omitting it from
  `Build_Production` leaves the token absent so Bugsee stays dormant on store
  builds ([CrashReporting.md](CrashReporting.md)).

The table above is the **build-required** set. The deployment stages read a few
more variables **from the same groups** — add these only when you
[enable deployment](#enabling-deployment); the base pipeline never reads them:

| Variable group | Variable | Secret? | Used by |
|----------------|----------|:-------:|---------|
| `…Distribution.Internal.Android` | `FirebaseAppId` | — | Firebase App Distribution (staging) |
| `…Distribution.GooglePlay` | `FirebaseAppId` | — | Firebase App Distribution (production) |
| " | `ApplicationIdentifier` | — | Google Play upload |
| " | `GooglePlayServiceConnection` | — | Google Play upload (connection name) |
| `…Distribution.Internal.iOS` **and** `…Distribution.AppStore` | `AppStoreServiceConnection` | — | TestFlight / App Store upload (connection name) |
| " | `ApplicationIdentifier` | — | " |
| " | `AppleTeamId` | — | " |
| " | `AppleTeamName` | — | " |
| " | `AppleStoreConnectIdentifier` | — | " (app-specific id, bypasses 2FA) |
| " | `AppleAppSpecificPassword` | ✅ | " (app-specific password) |

### Service connections & extensions (deployment only)

`AppStoreRelease@1` and `GooglePlayRelease@4` come from Marketplace extensions and
authenticate through service connections — both needed only when the deploy stages
are enabled:

| What | Where | Referenced as |
|------|-------|---------------|
| **Apple App Store** extension | Organization settings → Extensions | (provides `AppStoreRelease@1`) |
| **Google Play** extension | Organization settings → Extensions | (provides `GooglePlayRelease@4`) |
| Apple App Store Connect service connection | Project settings → Service connections | name stored in `$(AppStoreServiceConnection)` |
| Google Play service connection | Project settings → Service connections | name stored in `$(GooglePlayServiceConnection)` |

### Deployment environments (Pipelines → Environments)

Each deploy stage is a deployment job targeting a Pipelines **Environment** —
create these (empty is fine; add approvals/checks to gate a release):
`Firebase App Distribution`, `TestFlight`, `AppStore`, `GooglePlay`.

### Secure files (Pipelines → Library → Secure files)

Names are **bundle-id-prefixed** — the `.internal.` segment marks the staging
lane, and the production names drop it.
The iOS signing **certificate is a single shared file** (`nventive.p12`, the
nventive Apple-account distribution cert, which signs both provisioning
profiles); everything else is **per-lane** (never reuse a production keystore for
internal builds).

| Secure file name | Type | Template parameter | Lane |
|------------------|------|--------------------|------|
| `com.nventive.internal.reactnativeapptemplate.jks` | Android keystore (`.jks`) | `keystoreSecureFile` | Staging |
| `com.nventive.reactnativeapptemplate.jks` | Android keystore (`.jks`) | `keystoreSecureFile` | Production |
| `nventive.p12` | iOS signing cert (`.p12`) | `certificateSecureFile` | **Both** (shared) |
| `com.nventive.internal.reactnativeapptemplate.mobileprovision` | iOS provisioning profile | `provisioningProfileSecureFile` | Staging |
| `com.nventive.reactnativeapptemplate.mobileprovision` | iOS provisioning profile | `provisioningProfileSecureFile` | Production |
| `com.nventive.internal.reactnativeapptemplate.exportOptions.plist` | iOS export options plist | `exportOptionsSecureFile` | Staging |
| `com.nventive.reactnativeapptemplate.exportOptions.plist` | iOS export options plist | `exportOptionsSecureFile` | Production |
| `google-services-reactnative-internal.json` | Firebase Android config *(optional)* | `firebaseAndroidSecureFile` | Staging |
| `google-services-reactnative.json` | Firebase Android config *(optional)* | `firebaseAndroidSecureFile` | Production |
| `GoogleService-Info-reactnative-internal.plist` | Firebase iOS config *(optional)* | `firebaseIosSecureFile` | Staging |
| `GoogleService-Info-reactnative.plist` | Firebase iOS config *(optional)* | `firebaseIosSecureFile` | Production |
| `firebase-app-distribution-service-account.json` | Google service account for Firebase App Distribution *(deployment only)* | `firebaseServiceAccountSecureFile` | Both |

The four Firebase config files are **optional** (Firebase feature, off by default)
and the service-account JSON is **deployment only** — the pipeline ships with all
of them off. So the required set to build today is **7 files** (2 keystores, the
shared cert, 2 provisioning profiles, 2 export-options plists).

Where each comes from: keystore (`.jks`) via `keytool -genkeypair`; `nventive.p12`
exported from Keychain (the Apple distribution cert + private key); the
`.mobileprovision`s from the Apple Developer portal; `exportOptions.plist`
authored per export method (`app-store` for production, `ad-hoc`/`enterprise` for
internal); Firebase config files from the Firebase console (one project per lane).

> The production names use the **production bundle id** (no `.internal.`).
> `app.config.ts` currently emits the internal id for every lane; rebranding it
> for production is the project generator's job.

## One-time Azure DevOps setup (manual steps)

1. Create a pipeline pointing at `build/azure-pipelines.yml` on `main`.
2. Add a **branch policy** on `main` requiring `Commit_Validation`, `Verify`
   **and** `Build_Staging` to pass, so red PRs are blocked. These three stages run
   on PRs; everything downstream is skipped on PR builds.
3. Create the five **variable groups** in the table above and link each to the
   stage shown. Keep `…Bugsee.Tokens` linked to **`Build_Staging` only**.
4. Upload the **required secure files** in the table above under exactly those
   names — **7 files** (2 keystores, the shared `nventive.p12` cert, 2
   provisioning profiles, 2 export-options plists), or change the parameter
   values in `build/azure-pipelines.yml` to match your names. The 4 Firebase
   files are optional — skip them until you [enable Firebase](#enabling-firebase).
5. Provide an **emulator-capable agent** for `DeviceTests_Staging`.
6. Ensure the nightly **schedule** is enabled (Pipeline settings → Triggers).

The four **deployment stages** are separate and off by default — set them up only
when you want CI to distribute/publish; see [Enabling deployment](#enabling-deployment).

Until steps 3–5 are done, the signed-build and device-test stages will fail on
missing secure files/variable groups — expected, and why they are skipped on PRs.

## Platform-integration secrets

The public repo commits **no vendor keys** — CI injects them at build time:

- **Firebase config files** ([FirebaseRemoteConfig.md](FirebaseRemoteConfig.md)) —
  **optional and off by default** (see [Enabling Firebase](#enabling-firebase)).
  When enabled, they are secure files (one set per lane) that
  `templates/firebase-config.yml` copies to the repo paths **before**
  `expo prebuild`; their presence sets `FIREBASE_ENABLED=true`.
- **Bugsee tokens** ([CrashReporting.md](CrashReporting.md)) — secret variables
  in an **internal-lane variable group only**, passed as build env vars on the
  staging lane and **omitted from production**.

## Enabling Firebase

Firebase is **off by default** so a fresh clone (with no Firebase project yet)
builds and signs without it — matching the base template, where Firebase is
opt-in. The build templates key entirely off whether a Firebase secure-file name
was passed: no name ⇒ no download, no `FIREBASE_ENABLED`, and `expo prebuild`
produces no Firebase native footprint.

To turn it on for a lane:

1. Create the Firebase project(s) and download the config files
   (`google-services.json` / `GoogleService-Info.plist`).
2. Upload them as **secure files** under the names in the
   [secure-files table](#secure-files-pipelines--library--secure-files)
   (e.g. `google-services-reactnative-internal.json`).
3. In `build/azure-pipelines.yml`, **uncomment** the matching
   `firebaseAndroidSecureFile` / `firebaseIosSecureFile` line in that lane's job.
   That single line is the switch — the template derives `FIREBASE_ENABLED` from
   its presence, so there is no separate flag to set.

To turn it back off, re-comment the line (and optionally remove the secure file).
No other pipeline or app change is needed.

## Enabling deployment

The four deployment stages ship **commented out** because they need credentials a
fresh clone doesn't have. The build stages above work without any of this; set up
only the lanes you want CI to distribute.

**For internal distribution (staging → Firebase App Distribution + TestFlight):**

1. Install the **Apple App Store** Azure DevOps extension (org settings →
   Extensions).
2. Create an **App Store Connect** service connection and store its name in
   `AppStoreServiceConnection` in the `…Distribution.Internal.iOS` group; add the
   other [deployment variables](#variable-groups-pipelines--library--variable-groups)
   (`ApplicationIdentifier`, `AppleTeamId`, `AppleTeamName`,
   `AppleStoreConnectIdentifier`, `AppleAppSpecificPassword`) to the same group.
3. Create a Firebase **service-account** JSON with the *Firebase App Distribution
   Admin* role, upload it as the secure file
   `firebase-app-distribution-service-account.json`, and add `FirebaseAppId`
   (the Android app's Firebase app id) to the `…Distribution.Internal.Android`
   group.
4. Create the `Firebase App Distribution` and `TestFlight` **environments**
   (Pipelines → Environments).
5. **Uncomment** the `FirebaseDistribution_TestFlight_Staging` stage in
   `build/azure-pipelines.yml`.

**For store publishing (production → Google Play + App Store):**

6. Install the **Google Play** extension; create a **Google Play** service
   connection and store its name in `GooglePlayServiceConnection` in the
   `…Distribution.GooglePlay` group; add `ApplicationIdentifier` there too. Repeat
   the App Store Connect variables (step 2) in the `…Distribution.AppStore` group.
7. Create the `GooglePlay` and `AppStore` **environments**.
8. **Uncomment** the `GooglePlay` and `AppStore` stages.

**For Firebase distribution of the production build (optional):** set
`Build_Production`'s `artifactFormat` to `both` (so it emits an `.apk` alongside
the `.aab`), add `FirebaseAppId` to the `…Distribution.GooglePlay` group, and
uncomment the `FirebaseDistribution_Production` stage.

Both store tasks target their **internal / TestFlight** track only — moving a
build to public release is a deliberate manual step in the Play Console / App
Store Connect. Attach approvals to the environments if you want a human gate
before even the internal upload.

## Notes

- The iOS `xcodebuild` scheme name (`ReactNativeAppTemplate`) is derived by
  `expo prebuild` from the sanitized `name` in `app.config.ts`; if the app is
  renamed, update the `iosScheme` variable (the project generator does this).
- `yarn install --frozen-lockfile` guarantees CI uses exactly the committed
  `yarn.lock`.
- **Toolchain is pinned.** `macOSHostedAgentImage` and `xcodeVersion`
  ([`variables.yml`](../build/variables.yml)) are concrete versions, never a
  `-latest` alias — the image can't drift under us. `build-ios.yml` selects
  `/Applications/Xcode_$(xcodeVersion).app` and **fails fast** (listing the
  installed Xcodes) if that version is absent. Expo SDK 57 / RN 0.86 needs **Swift
  6.2 (Xcode 26+)**: the `ExpoModulesJSI` xcframework build runs a nested
  `xcodebuild` whose SwiftPM resolution fails on the older Swift an image default
  may ship. Two pitfalls when picking the version:
  - **The app path uses the marketing version verbatim.** `26.2` →
    `Xcode_26.2.app`, but a patch release is `26.0.1` → `Xcode_26.0.1.app` (there is
    **no** `Xcode_26.0.app`). Match what the image actually installs.
  - **The iOS device platform must be preinstalled for that Xcode.** On `macOS-26`
    the Xcode app is present but its matching iOS platform is **not** always baked in
    (actions/runner-images #13275, #13853) — the archive (`generic/platform=iOS`)
    then dies with "iOS &lt;ver&gt; is not installed", and the on-demand recovery is
    a multi-GB, flaky download. We pin **Xcode 26.2**, whose **iOS 26.2 platform
    ships preinstalled** (26.0/26.1 do not) — so no download runs. Check the image's
    "Pre-installed iOS Simulators" list in its `runner-images` Readme before bumping,
    and keep image + `xcodeVersion` in step with a preinstalled-platform version.

  As a safety net (future image drops the platform), the select step falls back to
  `xcodebuild -downloadPlatform iOS` — guarded so it's a no-op when the platform is
  already present — and prints the installed Xcodes and SDKs so any drift is
  self-diagnosing.
- **One vendored patch rides the toolchain pin.** `expo-modules-jsi@57.0.4` (the
  newest published) fails to compile on Xcode 26.2 — a bare `abs()` the Swift 6.2
  compiler can't disambiguate under C++ interop. We apply the upstream one-liner via
  [`patch-package`](https://github.com/ds300/patch-package) (`postinstall` in
  `package.json`, patch in [`patches/`](../patches/README.md)); CI's
  `yarn install --frozen-lockfile` runs `postinstall`, so the fix is in place before
  `expo prebuild`. Delete the patch once Expo ships the fix in a released
  `expo-modules-jsi > 57.0.4` — see [patches/README.md](../patches/README.md).
