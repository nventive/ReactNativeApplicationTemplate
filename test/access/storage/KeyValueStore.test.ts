/**
 * Tier 1 — plain TS. Exercises the `KeyValueStore` contract through the
 * in-memory implementation (the MMKV-backed impl can only run on a device, so
 * its native behavior is out of scope for headless tests).
 */
import { InMemoryKeyValueStore } from '../../../src/access/storage/InMemoryKeyValueStore';

describe('InMemoryKeyValueStore', () => {
  it('round-trips strings, booleans, and numbers', () => {
    const store = new InMemoryKeyValueStore();

    store.setString('s', 'hello');
    store.setBoolean('b', true);
    store.setNumber('n', 42);

    expect(store.getString('s')).toBe('hello');
    expect(store.getBoolean('b')).toBe(true);
    expect(store.getNumber('n')).toBe(42);
  });

  it('returns undefined for missing keys', () => {
    const store = new InMemoryKeyValueStore();

    expect(store.getString('missing')).toBeUndefined();
    expect(store.getBoolean('missing')).toBeUndefined();
    expect(store.getNumber('missing')).toBeUndefined();
  });

  it('returns undefined when reading a key with the wrong-typed getter', () => {
    const store = new InMemoryKeyValueStore();
    store.setString('s', 'not a number');

    expect(store.getNumber('s')).toBeUndefined();
    expect(store.getBoolean('s')).toBeUndefined();
    expect(store.getString('s')).toBe('not a number');
  });

  it('reports and removes keys', () => {
    const store = new InMemoryKeyValueStore();
    store.setString('k', 'v');

    expect(store.contains('k')).toBe(true);
    store.remove('k');
    expect(store.contains('k')).toBe(false);
    expect(store.getString('k')).toBeUndefined();
  });

  it('remove on a missing key is a no-op', () => {
    const store = new InMemoryKeyValueStore();
    expect(() => store.remove('nope')).not.toThrow();
  });

  it('enumerates all keys and clears the store', () => {
    const store = new InMemoryKeyValueStore();
    store.setString('a', '1');
    store.setNumber('b', 2);

    expect(store.getAllKeys().sort()).toEqual(['a', 'b']);

    store.clear();
    expect(store.getAllKeys()).toEqual([]);
    expect(store.contains('a')).toBe(false);
  });

  it('overwrites an existing value', () => {
    const store = new InMemoryKeyValueStore();
    store.setString('k', 'first');
    store.setString('k', 'second');

    expect(store.getString('k')).toBe('second');
  });
});
