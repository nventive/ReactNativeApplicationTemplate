// https://docs.expo.dev/develop/unit-testing/
//
// Extends the jest-expo preset programmatically (rather than via `preset:`)
// because two of its entries need surgery Jest's shallow config merge can't do:
// - MSW and some of its dependencies ship ESM-only `.mjs` files; the preset's
//   babel transform only matches `.js/.ts(x)`, so widen it to `.mjs`.
// - The preset's transformIgnorePatterns skips all of node_modules except
//   Expo/RN packages; MSW's package family must be transformed too.
const jestExpoPreset = require('jest-expo/jest-preset');

const transform = { ...jestExpoPreset.transform };
const babelEntry = transform['\\.[jt]sx?$'];
delete transform['\\.[jt]sx?$'];
transform['\\.m?[jt]sx?$'] = babelEntry;

module.exports = {
  ...jestExpoPreset,
  // Keep the preset's RN/Expo setup files, then add ours (safe-area mock, etc.).
  setupFiles: [...(jestExpoPreset.setupFiles ?? []), '<rootDir>/jest.setup.js'],
  transform,
  moduleNameMapper: {
    ...jestExpoPreset.moduleNameMapper,
    // msw declares its "./node" entry as null for the react-native platform
    // (RN apps are expected to use msw/native), but our tests run in Node —
    // point straight at the CJS builds the RN-flavored resolver refuses.
    '^msw$': '<rootDir>/node_modules/msw/lib/core/index.js',
    '^msw/node$': '<rootDir>/node_modules/msw/lib/node/index.js',
    // react-native-mmkv eagerly imports react-native-nitro-modules at load,
    // which throws in Node (no TurboModules). Swap in an in-memory mock so the
    // composition root's default MmkvKeyValueStore stays importable in tests.
    '^react-native-mmkv$': '<rootDir>/test/mocks/reactNativeMmkv.ts',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|msw|@mswjs|rettime|until-async|@open-draft|outvariant|strict-event-emitter|headers-polyfill|is-node-process|@bundled-es-modules))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  roots: ['<rootDir>/src', '<rootDir>/test', '<rootDir>/cli'],
  clearMocks: true,
  // Tests run in tens of ms warm, but the FIRST Tier-2 suite in a cold Jest
  // worker pays a large one-time module-load cost on slower machines (RN + Expo
  // + navigation). Raise the per-test ceiling above Jest's 5s default so cold
  // starts don't flake; it never affects warm runtimes.
  testTimeout: 20000,
};
