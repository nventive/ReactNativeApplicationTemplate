import type { KeyValueStore } from './KeyValueStore';

/**
 * In-memory `KeyValueStore` backed by a `Map`.
 *
 * Used by Tier-1 tests and anywhere the graph is booted in Node (where MMKV's
 * native module is unavailable). It is also the mock the runtime mocking toggle
 * can select to run the app fully in-memory.
 *
 * Values are stored in their native type (matching MMKV's typed getters);
 * reading a key with the wrong-typed getter returns `undefined`, so callers get
 * the same "typed access" behavior they would on device.
 */
export class InMemoryKeyValueStore implements KeyValueStore {
  private readonly store = new Map<string, string | number | boolean>();

  getString(key: string): string | undefined {
    const value = this.store.get(key);
    return typeof value === 'string' ? value : undefined;
  }

  setString(key: string, value: string): void {
    this.store.set(key, value);
  }

  getBoolean(key: string): boolean | undefined {
    const value = this.store.get(key);
    return typeof value === 'boolean' ? value : undefined;
  }

  setBoolean(key: string, value: boolean): void {
    this.store.set(key, value);
  }

  getNumber(key: string): number | undefined {
    const value = this.store.get(key);
    return typeof value === 'number' ? value : undefined;
  }

  setNumber(key: string, value: number): void {
    this.store.set(key, value);
  }

  contains(key: string): boolean {
    return this.store.has(key);
  }

  remove(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  getAllKeys(): string[] {
    return [...this.store.keys()];
  }
}
