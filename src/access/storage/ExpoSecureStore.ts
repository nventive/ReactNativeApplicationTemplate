import * as SecureStoreModule from 'expo-secure-store';

import type { SecureStore } from './SecureStore';

/**
 * The real `SecureStore`, backed by expo-secure-store (iOS Keychain / Android
 * Keystore).
 *
 * ⚠️ The native module is **not available under Jest/Node**, so this class must
 * only be instantiated on a device. Tests use `InMemorySecureStore` (injected
 * via the `secureStore` override in `createServices`).
 *
 * `getItemAsync` resolves to `null` for a missing key; this adapter normalizes
 * that to `undefined` to match the `KeyValueStore` "absent = undefined"
 * convention across the storage layer.
 */
export class ExpoSecureStore implements SecureStore {
  async getItem(key: string): Promise<string | undefined> {
    const value = await SecureStoreModule.getItemAsync(key);
    return value ?? undefined;
  }

  setItem(key: string, value: string): Promise<void> {
    return SecureStoreModule.setItemAsync(key, value);
  }

  removeItem(key: string): Promise<void> {
    return SecureStoreModule.deleteItemAsync(key);
  }
}
