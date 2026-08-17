/**
 * Tier 1 — plain TS. Exercises the `SecureStore` contract through the in-memory
 * implementation (expo-secure-store's native keychain is device-only).
 */
import { InMemorySecureStore } from '../../../src/access/storage/InMemorySecureStore';

describe('InMemorySecureStore', () => {
  it('round-trips a secret', async () => {
    const store = new InMemorySecureStore();

    await store.setItem('token', 'secret-value');

    await expect(store.getItem('token')).resolves.toBe('secret-value');
  });

  it('resolves undefined for a missing key', async () => {
    const store = new InMemorySecureStore();

    await expect(store.getItem('missing')).resolves.toBeUndefined();
  });

  it('removes a secret', async () => {
    const store = new InMemorySecureStore();
    await store.setItem('token', 'secret-value');

    await store.removeItem('token');

    await expect(store.getItem('token')).resolves.toBeUndefined();
  });

  it('overwrites an existing secret', async () => {
    const store = new InMemorySecureStore();
    await store.setItem('token', 'first');
    await store.setItem('token', 'second');

    await expect(store.getItem('token')).resolves.toBe('second');
  });
});
