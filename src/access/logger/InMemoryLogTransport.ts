import { BehaviorSubject, type Observable } from 'rxjs';

import type { LogBufferReader, LogEntry } from './Logger';
import type { LogTransport } from './LogTransport';

/** How many recent entries the buffer keeps before dropping the oldest. */
export const DEFAULT_LOG_BUFFER_CAPACITY = 300;

/**
 * A bounded in-memory ring buffer of the most recent {@link LogEntry}s, feeding
 * the in-app log console (and, since HTTP is logged through the same `Logger`,
 * the in-app network inspector). It carries no native dependency and is fully
 * Tier-1 testable.
 *
 * It implements {@link LogTransport} (so it plugs into the `CompositeLogger`
 * fan-out like any other sink) and {@link LogBufferReader} (so the diagnostics
 * console can read/subscribe to it) — the same dual-role pattern the
 * `FileTransport` uses for the file viewer.
 *
 * `write` is synchronous and never throws: it appends and trims to `capacity`,
 * pushing the new snapshot onto a `BehaviorSubject`. Entries only reach the
 * buffer after the logger's level filter, so it reflects the active minimum
 * level (full `debug` detail in development).
 */
export class InMemoryLogTransport implements LogTransport, LogBufferReader {
  private readonly _entries$: BehaviorSubject<readonly LogEntry[]>;
  readonly entries$: Observable<readonly LogEntry[]>;

  constructor(private readonly capacity: number = DEFAULT_LOG_BUFFER_CAPACITY) {
    this._entries$ = new BehaviorSubject<readonly LogEntry[]>([]);
    this.entries$ = this._entries$.asObservable();
  }

  write(entry: LogEntry): void {
    const current = this._entries$.getValue();
    const next = [...current, entry];
    if (next.length > this.capacity) {
      next.splice(0, next.length - this.capacity);
    }
    this._entries$.next(next);
  }

  getEntries(): readonly LogEntry[] {
    return this._entries$.getValue();
  }

  clear(): void {
    this._entries$.next([]);
  }
}
