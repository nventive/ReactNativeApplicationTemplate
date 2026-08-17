/**
 * Tier 1 — plain TS. Covers the in-memory ring buffer that backs the in-app log
 * console: it records entries, exposes them live, caps at capacity (dropping the
 * oldest), and clears.
 */
import { InMemoryLogTransport } from '../../../src/access/logger/InMemoryLogTransport';
import type { LogEntry } from '../../../src/access/logger/Logger';

function entry(message: string): LogEntry {
  return { level: 'info', message, timestamp: new Date('2026-01-01T00:00:00Z') };
}

describe('InMemoryLogTransport', () => {
  it('records written entries in order and exposes a snapshot', () => {
    const buffer = new InMemoryLogTransport();

    buffer.write(entry('first'));
    buffer.write(entry('second'));

    expect(buffer.getEntries().map((e) => e.message)).toEqual(['first', 'second']);
  });

  it('emits the current entries on entries$', () => {
    const buffer = new InMemoryLogTransport();
    const emissions: number[] = [];
    const sub = buffer.entries$.subscribe((entries) => emissions.push(entries.length));

    buffer.write(entry('a'));
    buffer.write(entry('b'));

    // BehaviorSubject replays the initial empty state, then one emission per write.
    expect(emissions).toEqual([0, 1, 2]);
    sub.unsubscribe();
  });

  it('caps at capacity, dropping the oldest entries', () => {
    const buffer = new InMemoryLogTransport(2);

    buffer.write(entry('one'));
    buffer.write(entry('two'));
    buffer.write(entry('three'));

    expect(buffer.getEntries().map((e) => e.message)).toEqual(['two', 'three']);
  });

  it('clears every buffered entry', () => {
    const buffer = new InMemoryLogTransport();
    buffer.write(entry('x'));

    buffer.clear();

    expect(buffer.getEntries()).toEqual([]);
  });
});
