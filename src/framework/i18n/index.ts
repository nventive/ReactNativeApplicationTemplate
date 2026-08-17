import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { detectLanguage } from './detectLocale';
import en from './locales/en.json';
import fr from './locales/fr.json';

/**
 * i18next setup — the localization concern (i18next + react-i18next +
 * expo-localization), with bundled en/fr resources.
 *
 * Resources are bundled and initialization is synchronous, so strings are ready
 * before the first render (no Suspense fallback needed). `en` is both the source
 * of truth for the typed keys (see react-i18next.d.ts) and the fallback
 * language. Import this module for its side effect once, from the app entry
 * point.
 */
export const supportedLngs = ['en', 'fr'] as const;
export const fallbackLng = 'en';

export const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: detectLanguage(supportedLngs, fallbackLng),
    fallbackLng,
    supportedLngs: [...supportedLngs],
    interpolation: { escapeValue: false }, // RN is not the DOM — no HTML escaping.
    returnNull: false,
    react: { useSuspense: false },
  });
}

export default i18n;
