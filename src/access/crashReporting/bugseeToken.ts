import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * The Bugsee app-token format — a GUID. A build-injected token is validated
 * against this before Bugsee is launched, so an empty/placeholder token (the
 * value the public repo ships) cleanly disables reporting instead of erroring.
 */
export const BUGSEE_TOKEN_FORMAT =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Normalizes a build-injected token to the single string used for **both**
 * validation and launch — trimming whitespace a CI variable can pick up, and
 * mapping an empty result to `undefined`. Call this once at the crash-reporting
 * boundary ({@link resolveCrashReporter}) so the validated and launched values
 * can never diverge.
 */
export function normalizeBugseeToken(token: string | undefined): string | undefined {
  const trimmed = token?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Whether a token is well-formed enough to launch Bugsee with. Expects a value
 * already run through {@link normalizeBugseeToken}.
 */
export function isValidBugseeToken(token: string | undefined): token is string {
  return typeof token === 'string' && BUGSEE_TOKEN_FORMAT.test(token);
}

/**
 * The Bugsee app token for the current platform, read from the build config
 * surfaced through expo-constants (`extra.bugsee.{ios,android}`).
 *
 * **Secrets policy (public repo):** the token is never committed. `app.config.ts`
 * reads it from the `BUGSEE_IOS_TOKEN` / `BUGSEE_ANDROID_TOKEN` build environment
 * variables, which CI injects **only for internal build lanes** — production
 * lanes get none, so this returns `undefined` there and reporting stays off. See
 * `doc/CrashReporting.md`.
 */
export function getBugseeToken(): string | undefined {
  const tokens = Constants.expoConfig?.extra?.bugsee as
    { ios?: string; android?: string } | undefined;
  if (!tokens) return undefined;
  return Platform.OS === 'ios' ? tokens.ios : tokens.android;
}
