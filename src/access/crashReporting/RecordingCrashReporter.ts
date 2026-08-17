import type { CrashReporter } from './CrashReporter';

/** A single call captured by {@link RecordingCrashReporter}. */
export type CrashReporterRecord =
  | { readonly type: 'error'; readonly error: unknown; readonly context?: Record<string, unknown> }
  | { readonly type: 'event'; readonly name: string; readonly properties?: Record<string, unknown> }
  | { readonly type: 'attribute'; readonly key: string; readonly value: string | number | boolean };

/**
 * In-memory {@link CrashReporter} for Tier-1/Tier-2 assertions ("the error
 * boundary reported the crash"). Records every call; asserts nothing. `isEnabled`
 * is configurable so tests can exercise both the enabled and disabled UI states.
 */
export class RecordingCrashReporter implements CrashReporter {
  readonly records: CrashReporterRecord[] = [];

  constructor(readonly isEnabled: boolean = true) {}

  recordError(error: unknown, context?: Record<string, unknown>): void {
    this.records.push({ type: 'error', error, context });
  }

  recordEvent(name: string, properties?: Record<string, unknown>): void {
    this.records.push({ type: 'event', name, properties });
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.records.push({ type: 'attribute', key, value });
  }

  /** Every recorded entry of the given kind. */
  recordsOf<T extends CrashReporterRecord['type']>(
    type: T,
  ): Extract<CrashReporterRecord, { type: T }>[] {
    return this.records.filter(
      (record): record is Extract<CrashReporterRecord, { type: T }> => record.type === type,
    );
  }
}
