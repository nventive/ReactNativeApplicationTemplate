/**
 * Jest mock for `react-native-mmkv`, wired via `moduleNameMapper` in
 * jest.config.js.
 *
 * The real package eagerly imports `react-native-nitro-modules` at module load,
 * which throws in a Node/Jest environment (no TurboModules). MMKV's own
 * `isTest()` path would return an in-memory mock, but only after that failing
 * import — so we substitute a self-contained in-memory `createMMKV` here.
 *
 * App code never depends on this: production storage uses the real MMKV on
 * device, and Tier-1 tests that assert storage behavior use
 * `InMemoryKeyValueStore`. This mock only keeps `createServices()`'s default
 * `MmkvKeyValueStore` importable/constructable when the graph is booted in Node.
 */
type Value = string | number | boolean | ArrayBuffer;

export function createMMKV() {
  const store = new Map<string, Value>();
  return {
    id: 'mock',
    set(key: string, value: Value): void {
      store.set(key, value);
    },
    getString(key: string): string | undefined {
      const value = store.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    getNumber(key: string): number | undefined {
      const value = store.get(key);
      return typeof value === 'number' ? value : undefined;
    },
    getBoolean(key: string): boolean | undefined {
      const value = store.get(key);
      return typeof value === 'boolean' ? value : undefined;
    },
    contains(key: string): boolean {
      return store.has(key);
    },
    remove(key: string): boolean {
      return store.delete(key);
    },
    getAllKeys(): string[] {
      return [...store.keys()];
    },
    clearAll(): void {
      store.clear();
    },
  };
}

// The real module also exports a `MMKV` type; it is erased at runtime, so no
// runtime counterpart is needed here.
