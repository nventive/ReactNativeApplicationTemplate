# Localization

Multi-language strings via **i18next + react-i18next + expo-localization** — an
English source plus French, with device-locale detection and fallback. Adds a
lint guardrail that keeps hardcoded copy out of the UI.

## Resources

Strings live in per-language JSON under
[`src/framework/i18n/locales/`](../src/framework/i18n/locales) (`en.json`,
`fr.json`), grouped by feature. `en` is the source of truth.

## Reading a string

Components read strings through the `useTranslation` hook:

```tsx
const { t } = useTranslation();
return <Text>{t('jokes.title')}</Text>;          // "Dad Jokes"
// interpolation:
t('common.error', { error: message });            // "Error: …"
```

Navigator titles are localized the same way (the navigators are components that
call `useTranslation`).

## Typed keys (guardrail)

[`react-i18next.d.ts`](../src/framework/i18n/react-i18next.d.ts) augments i18next's
types so `en.json` is the source of truth — `t('bad.key')` is a **compile error**
and editors autocomplete valid keys. `fr.json` is kept structurally in sync by a
Tier-1 key-consistency test.

## No-literal-strings (guardrail)

`eslint-plugin-i18next`'s `no-literal-string` rule runs on `src/presentation/**`
in `jsx-text-only` mode (see [eslint.config.js](../eslint.config.js)): visible JSX
text that isn't wrapped in `t()` fails the lint. It leaves `testID`, styles, and
other attributes alone; decorative glyphs (icons) are kept as named constants so
they read as identifiers, not copy.

## Detection & fallback

[`index.ts`](../src/framework/i18n/index.ts) initializes i18next synchronously
with the bundled resources, so strings are ready before first render (no Suspense
fallback).
[`detectLanguage`](../src/framework/i18n/detectLocale.ts) reads the device's
preferred locale via expo-localization and falls back to English for anything
unsupported. Import the
module once for its side effect (from `App.tsx`; test files that render screens do
the same).

## Adding a string / a language

- **String:** add the key to `en.json` *and* `fr.json` (the key-consistency test
  enforces both), then use `t('group.key')`.
- **Language:** add `xx.json`, register it in `resources` and `supportedLngs` in
  `index.ts`.
