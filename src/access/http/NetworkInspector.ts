import { BehaviorSubject, type Observable } from 'rxjs';

/** Lifecycle of a captured HTTP exchange. */
export type NetworkExchangeState = 'pending' | 'success' | 'failure';

/**
 * A captured HTTP request/response pair, rich enough for an in-app inspector
 * (headers, payload, timing). Bodies and headers are captured **only in memory**
 * for the diagnostics inspector (never written to the log file), size-capped, and
 * with sensitive headers redacted.
 */
export interface NetworkExchange {
  /** Stable id correlating the request with its response/failure. */
  readonly id: string;
  readonly method: string;
  readonly url: string;
  readonly requestHeaders: Readonly<Record<string, string>>;
  /** Serialized request payload (capped), or undefined when there is none. */
  readonly requestBody?: string;
  /** Epoch ms when the request left. */
  readonly startedAt: number;
  readonly state: NetworkExchangeState;
  readonly status?: number;
  readonly responseHeaders?: Readonly<Record<string, string>>;
  /** Serialized response payload (capped). */
  readonly responseBody?: string;
  /** Round-trip time in ms, set on completion. */
  readonly durationMs?: number;
  /** The mapped error `kind` when `state === 'failure'`. */
  readonly errorKind?: string;
}

/** The request fields captured when an exchange begins. */
export interface NetworkRequestCapture {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly requestBody?: string;
}

/** The response fields captured when an exchange succeeds. */
export interface NetworkResponseCapture {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly responseBody?: string;
}

/** The fields captured when an exchange fails. */
export interface NetworkFailureCapture {
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly responseBody?: string;
  readonly errorKind: string;
}

/**
 * The recording surface the HTTP interceptor writes to — separate from the
 * read surface so only the interceptor mutates the store (same reader/writer
 * split as the file transport's `LogTransport` vs `LogFileReader`).
 */
export interface NetworkRecorder {
  /** Records a started request and returns its correlation id. */
  begin(request: NetworkRequestCapture): string;
  /** Completes the exchange as a success (fills timing from `begin`). */
  complete(id: string, response: NetworkResponseCapture): void;
  /** Completes the exchange as a failure. */
  fail(id: string, failure: NetworkFailureCapture): void;
}

/**
 * The read surface the in-app network inspector consumes: the captured
 * exchanges as live state (a `BehaviorSubject` behind the interface, bridged to
 * the UI via `useObservable`).
 */
export interface NetworkInspector {
  readonly exchanges$: Observable<readonly NetworkExchange[]>;
  getExchanges(): readonly NetworkExchange[];
  clear(): void;
}

/** How many exchanges the ring buffer keeps before dropping the oldest. */
export const DEFAULT_NETWORK_CAPACITY = 100;

/**
 * In-memory {@link NetworkInspector} + {@link NetworkRecorder} — a bounded ring
 * buffer of recent HTTP exchanges backing the in-app network inspector. No native
 * dependency; fully Tier-1 testable.
 *
 * `begin` seeds a `pending` exchange; `complete`/`fail` fill it in place (matched
 * by id) so a slow request shows as pending until it resolves. Duration is
 * computed here from the stored `startedAt`, so callers never pass timing.
 */
export class InMemoryNetworkInspector implements NetworkInspector, NetworkRecorder {
  private readonly _exchanges$: BehaviorSubject<readonly NetworkExchange[]>;
  readonly exchanges$: Observable<readonly NetworkExchange[]>;
  private nextId = 1;

  constructor(
    private readonly capacity: number = DEFAULT_NETWORK_CAPACITY,
    /** Injectable clock so timing is deterministic in tests; defaults to `Date.now`. */
    private readonly now: () => number = () => Date.now(),
  ) {
    this._exchanges$ = new BehaviorSubject<readonly NetworkExchange[]>([]);
    this.exchanges$ = this._exchanges$.asObservable();
  }

  getExchanges(): readonly NetworkExchange[] {
    return this._exchanges$.getValue();
  }

  clear(): void {
    this._exchanges$.next([]);
  }

  begin(request: NetworkRequestCapture): string {
    const id = String(this.nextId++);
    const exchange: NetworkExchange = {
      id,
      method: request.method,
      url: request.url,
      requestHeaders: request.headers,
      requestBody: request.requestBody,
      startedAt: this.now(),
      state: 'pending',
    };
    const next = [...this._exchanges$.getValue(), exchange];
    if (next.length > this.capacity) {
      next.splice(0, next.length - this.capacity);
    }
    this._exchanges$.next(next);
    return id;
  }

  complete(id: string, response: NetworkResponseCapture): void {
    this.patch(id, (exchange) => ({
      ...exchange,
      state: 'success',
      status: response.status,
      responseHeaders: response.headers,
      responseBody: response.responseBody,
      durationMs: this.now() - exchange.startedAt,
    }));
  }

  fail(id: string, failure: NetworkFailureCapture): void {
    this.patch(id, (exchange) => ({
      ...exchange,
      state: 'failure',
      status: failure.status,
      responseHeaders: failure.headers,
      responseBody: failure.responseBody,
      errorKind: failure.errorKind,
      durationMs: this.now() - exchange.startedAt,
    }));
  }

  /** Replaces the exchange with the given id, if it is still in the buffer. */
  private patch(id: string, update: (exchange: NetworkExchange) => NetworkExchange): void {
    const current = this._exchanges$.getValue();
    const index = current.findIndex((exchange) => exchange.id === id);
    if (index === -1) {
      return; // Dropped from the ring buffer already; nothing to update.
    }
    const next = [...current];
    next[index] = update(current[index]);
    this._exchanges$.next(next);
  }
}
