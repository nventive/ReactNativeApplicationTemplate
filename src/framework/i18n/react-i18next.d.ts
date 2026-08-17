import 'react-i18next';

import type en from './locales/en.json';

/**
 * Makes i18n keys type-safe: `en.json` is the source of truth, so `t('bad.key')`
 * is a compile error and editors autocomplete valid keys. `fr.json` is kept
 * structurally in sync by a Tier-1 key-consistency test.
 */
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
    returnNull: false;
  }
}
