import type { ExpoConfig } from 'expo/config';

/**
 * Selects the build-default environment (dev / staging / prod) from the
 * `APP_ENV` build variable. Set it per build, e.g.
 * `APP_ENV=staging npx expo prebuild` (use `cross-env` on Windows) or a CI
 * pipeline variable. It is surfaced at runtime through `expo-constants`
 * (`Constants.expoConfig.extra.defaultEnvironment`) and read only by
 * `src/framework/config/appEnvironment.ts`; features consume the runtime
 * `EnvironmentService`, never this value directly.
 *
 * Unknown/unset values fall back to `development` (validated again at runtime).
 */
const APP_ENVIRONMENTS = ['development', 'staging', 'production'] as const;
type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

function resolveDefaultEnvironment(): AppEnvironment {
  const value = process.env.APP_ENV;
  return (APP_ENVIRONMENTS as readonly string[]).includes(value ?? '')
    ? (value as AppEnvironment)
    : 'development';
}

/**
 * Expo app configuration.
 *
 * Kept as TypeScript (not static JSON) so it can compute the build-default
 * environment above. Features must never read this at runtime — they consume
 * the runtime `EnvironmentService`.
 *
 * Deliberately absent:
 * - No EAS Build configuration (native builds run on Azure Pipelines via
 *   `expo prebuild` + Gradle/Xcode).
 * - No `expo-updates` / OTA configuration (remote intervention is handled by
 *   the forced-update and kill-switch features).
 *
 * Secrets policy (this repo is public): **no vendor API keys are committed.**
 * - Firebase: the config plugin + `googleServicesFile` paths are added
 *   only when `FIREBASE_ENABLED=true`. A project activating Firebase installs
 *   `@react-native-firebase/*`, provides the real `google-services.json` /
 *   `GoogleService-Info.plist` (gitignored — commit only the `.example`
 *   placeholders), and sets the flag; CI injects the real files per lane. A fresh
 *   clone without the flag prebuilds clean, with no Firebase native footprint.
 * - Bugsee: the per-platform app tokens come from build-time env vars
 *   injected by CI **for internal lanes only** (empty on production and in the
 *   repo), surfaced through `extra.bugsee` — a client token that ships in the
 *   binary by nature, never a server secret. See `doc/CrashReporting.md`.
 */

/**
 * Version and native build number. Both are supplied by CI at build time and
 * fall back to sensible defaults for a local `expo prebuild`:
 * - `APP_VERSION` → the marketing/semver version (iOS `CFBundleShortVersionString`
 *   / Android `versionName`), e.g. GitVersion's `MajorMinorPatch` (`1.0.0`).
 * - `APP_BUILD_NUMBER` → the monotonic native build number (iOS `CFBundleVersion`
 *   / Android `versionCode`), e.g. GitVersion's commit-based `PreReleaseNumber`
 *   (plus an optional `BuildPadding`).
 * The pipeline calculates both from the Git history with GitVersion and injects
 * them into prebuild — see `doc/AzurePipelines.md` § "Versioning". `versionCode`
 * must be an integer, so a non-numeric value falls back to 1.
 */
const appVersion = process.env.APP_VERSION ?? '1.0.0';
const appBuildNumber = process.env.APP_BUILD_NUMBER ?? '1';
const androidVersionCode = Number.parseInt(appBuildNumber, 10) || 1;

/**
 * Bundle identifier / Android package, selected per lane from `APP_ENV`.
 *
 * Production drops the `.internal.` segment; development and staging keep it.
 * This must match the signing assets each CI lane injects — the production
 * provisioning profile / keystore are registered against the id without
 * `.internal.`, the internal ones against the id with it (see
 * `build/variables.yml` § "Secure files"). Emitting the internal id for a
 * production archive makes manual code signing fail with a bundle-id/profile
 * mismatch.
 */
const bundleId =
  resolveDefaultEnvironment() === 'production'
    ? 'com.nventive.reactnativeapptemplate'
    : 'com.nventive.internal.reactnativeapptemplate';

/** Firebase is opt-in and off by default so a clean clone builds with no config files. */
const firebaseEnabled = process.env.FIREBASE_ENABLED === 'true';
const androidGoogleServicesFile =
  process.env.ANDROID_GOOGLE_SERVICES_FILE ?? './google-services.json';
const iosGoogleServicesFile = process.env.IOS_GOOGLE_SERVICES_FILE ?? './GoogleService-Info.plist';

const config: ExpoConfig = {
  name: 'React Native App Template',
  slug: 'react-native-application-template',
  version: appVersion,
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Follow the OS light/dark setting. The presentation layer is fully themed for
  // both (`tokens.ts` lightColors/darkColors, ThemeProvider's `system` mode reads
  // `useColorScheme()`); pinning this to `light` would lock the native appearance
  // and stop `useColorScheme()` from ever reporting dark, silently defeating that.
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: bundleId,
    buildNumber: appBuildNumber,
    // Only wired when Firebase is activated — the file is gitignored (real) /
    // committed as a `.example` placeholder.
    ...(firebaseEnabled ? { googleServicesFile: iosGoogleServicesFile } : {}),
  },
  android: {
    package: bundleId,
    versionCode: androidVersionCode,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    ...(firebaseEnabled ? { googleServicesFile: androidGoogleServicesFile } : {}),
  },
  web: {
    favicon: './assets/favicon.png',
  },
  // Config plugins for native modules that need prebuild setup. MMKV,
  // react-native-screens, and safe-area-context autolink and need none. The
  // Firebase plugins are added only when the integration is activated,
  // so a clean clone prebuilds without the optional SDKs installed.
  plugins: [
    'expo-secure-store',
    'expo-localization',
    // Native launch screen. Without this, `expo prebuild` yields Expo's blank
    // default splash and `assets/splash-icon.png` ships unused. The `backgroundColor`
    // values mirror the light/dark theme `background` tokens (`tokens.ts`) so the
    // splash bleeds seamlessly into the first screen in either OS appearance; the
    // logo asset is theme-agnostic (reads on both), so only the background swaps.
    // Splash auto-hides on the first rendered frame — startup composition is
    // synchronous, so there is no async bootstrap to hold it for.
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#EAF1FB',
        dark: {
          backgroundColor: '#1E2226',
        },
      },
    ],
    ...(firebaseEnabled
      ? [
          '@react-native-firebase/app',
          ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
        ]
      : []),
  ] as ExpoConfig['plugins'],
  // Surfaced at runtime via expo-constants. Do NOT put server secrets here — it is
  // bundled into the app, not secure storage. The Bugsee entries are client app
  // tokens (embedded in the binary by nature) read from CI-injected build env
  // vars; they are empty in the repo and on production lanes.
  extra: {
    defaultEnvironment: resolveDefaultEnvironment(),
    bugsee: {
      ios: process.env.BUGSEE_IOS_TOKEN,
      android: process.env.BUGSEE_ANDROID_TOKEN,
    },
  },
};

export default config;
