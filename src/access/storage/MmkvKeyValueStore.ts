import { createMMKV, type MMKV } from 'react-native-mmkv';

import type { KeyValueStore } from './KeyValueStore';

/**
 * The real `KeyValueStore`, backed by react-native-mmkv (a synchronous,
 * native-C++ key/value store).
 *
 * ⚠️ The MMKV native module is **not available under Jest/Node**, so this class
 * must only ever be instantiated on a device. Tests and the composition root
 * under test use `InMemoryKeyValueStore` instead (injected via the
 * `keyValueStore` override in `createServices`).
 */
export class MmkvKeyValueStore implements KeyValueStore {
  private readonly mmkv: MMKV;

  constructor(instance?: MMKV) {
    // Default to a single shared instance; a distinct `id` can partition storage
    // (e.g. per-user) if a feature ever needs it.
    this.mmkv = instance ?? createMMKV();
  }

  getString(key: string): string | undefined {
    return this.mmkv.getString(key);
  }

  setString(key: string, value: string): void {
    this.mmkv.set(key, value);
  }

  getBoolean(key: string): boolean | undefined {
    return this.mmkv.getBoolean(key);
  }

  setBoolean(key: string, value: boolean): void {
    this.mmkv.set(key, value);
  }

  getNumber(key: string): number | undefined {
    return this.mmkv.getNumber(key);
  }

  setNumber(key: string, value: number): void {
    this.mmkv.set(key, value);
  }

  contains(key: string): boolean {
    return this.mmkv.contains(key);
  }

  remove(key: string): void {
    this.mmkv.remove(key);
  }

  clear(): void {
    this.mmkv.clearAll();
  }

  getAllKeys(): string[] {
    return this.mmkv.getAllKeys();
  }
}
