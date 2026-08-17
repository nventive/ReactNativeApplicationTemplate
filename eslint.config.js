// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const i18next = require('eslint-plugin-i18next');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    rules: {
      // Guardrail: stale hook dependencies are the #1 hook footgun — a
      // violation fails the lint, not just warns.
      'react-hooks/exhaustive-deps': 'error',
      // False positives with libraries that expose the same name as both a
      // default-export method and a named export (axios.create/isAxiosError,
      // i18next's .use). The default-import usage is idiomatic for both.
      'import/no-named-as-default-member': 'off',
    },
  },
  {
    // Jest setup file (plain CommonJS) needs the jest global.
    files: ['jest.setup.js'],
    languageOptions: {
      globals: { jest: 'readonly' },
    },
  },
  {
    // Guardrail: user-facing copy in the Presentation layer must go
    // through i18n (`t('key')`), not be hardcoded. Scoped to screens/components;
    // `jsx-text-only` targets visible JSX text and leaves testIDs, styles, and
    // other attributes alone.
    files: ['src/presentation/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
  {
    ignores: ['dist/**', 'android/**', 'ios/**', '.expo/**', 'coverage/**', 'expo-env.d.ts'],
  },
]);
