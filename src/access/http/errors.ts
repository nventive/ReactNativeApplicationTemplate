import axios from 'axios';

/**
 * The typed error taxonomy every Access boundary surfaces. Raw `AxiosError`s and
 * zod failures are converted into these so no
 * layer above Access ever sees a transport-specific error — screens branch on
 * `kind` / `instanceof` to render the right state (see `doc/ErrorHandling.md`).
 */
export type HttpErrorKind = 'network' | 'server' | 'parse' | 'unauthorized';

export abstract class HttpError extends Error {
  abstract readonly kind: HttpErrorKind;

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    // Preserve `instanceof` across TypeScript's down-leveling in Metro/Hermes.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** No response received — offline, DNS failure, timeout, connection reset. */
export class NetworkError extends HttpError {
  readonly kind = 'network';
}

/** A non-2xx HTTP response that isn't an (unrecovered) auth failure. */
export class ServerError extends HttpError {
  readonly kind = 'server';

  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

/** A 2xx body that failed schema (zod / JSON) decoding at the boundary. */
export class ParseError extends HttpError {
  readonly kind = 'parse';

  constructor(
    readonly issues: unknown,
    cause?: unknown,
  ) {
    super('Invalid response payload', cause);
  }
}

/** A 401 that survived refresh + retry — the session is gone. */
export class UnauthorizedError extends HttpError {
  readonly kind = 'unauthorized';
}

/** Type guard for the taxonomy. */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

/**
 * Maps an arbitrary thrown value (typically an `AxiosError`) to the taxonomy.
 * Used by the error-mapping interceptor; a value already in the taxonomy passes
 * through unchanged.
 */
export function toHttpError(error: unknown): HttpError {
  if (isHttpError(error)) {
    return error;
  }
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        return new UnauthorizedError('Unauthorized', error);
      }
      return new ServerError(status, `Request failed with status ${status}`, data, error);
    }
    // Request was made but no response arrived.
    return new NetworkError(error.message || 'Network request failed', error);
  }
  return new NetworkError('Unexpected network error', error);
}
