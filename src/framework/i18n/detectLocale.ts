import { getLocales } from 'expo-localization';

/**
 * Picks the best-supported language from the device's preferred locales, falling
 * back to `fallback` for anything unsupported.
 *
 * Kept separate from the i18n init module so it can be unit-tested by mocking
 * expo-localization, and so the init stays declarative.
 */
export function detectLanguage(supported: readonly string[], fallback: string): string {
  const code = getLocales()[0]?.languageCode ?? undefined;
  return code !== undefined && supported.includes(code) ? code : fallback;
}
