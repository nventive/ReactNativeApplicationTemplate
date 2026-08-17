/**
 * Tier 1 — plain TS. Unit-tests the error taxonomy and the `AxiosError` mapper
 * in isolation (the MSW scenarios in httpClient.test.ts exercise it end to end).
 */
import { AxiosError, type AxiosResponse } from 'axios';

import {
  isHttpError,
  NetworkError,
  ParseError,
  ServerError,
  toHttpError,
  UnauthorizedError,
} from '../../../src/access/http/errors';

function axiosErrorWithStatus(status: number, data: unknown = {}): AxiosError {
  const response = { status, data } as AxiosResponse;
  return new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, {}, response);
}

describe('toHttpError', () => {
  it('maps a response with a 5xx status to ServerError', () => {
    const mapped = toHttpError(axiosErrorWithStatus(500, { message: 'nope' }));

    expect(mapped).toBeInstanceOf(ServerError);
    expect((mapped as ServerError).status).toBe(500);
    expect((mapped as ServerError).body).toEqual({ message: 'nope' });
  });

  it('maps a 401 response to UnauthorizedError', () => {
    expect(toHttpError(axiosErrorWithStatus(401))).toBeInstanceOf(UnauthorizedError);
  });

  it('maps an AxiosError without a response to NetworkError', () => {
    const noResponse = new AxiosError('Network Error', 'ERR_NETWORK');

    expect(toHttpError(noResponse)).toBeInstanceOf(NetworkError);
  });

  it('maps an unknown thrown value to NetworkError', () => {
    expect(toHttpError('some string')).toBeInstanceOf(NetworkError);
  });

  it('passes an existing HttpError through unchanged', () => {
    const original = new ParseError({ issue: 'bad' });

    expect(toHttpError(original)).toBe(original);
  });
});

describe('isHttpError', () => {
  it('recognizes taxonomy members and rejects plain errors', () => {
    expect(isHttpError(new NetworkError('x'))).toBe(true);
    expect(isHttpError(new ServerError(500, 'x'))).toBe(true);
    expect(isHttpError(new Error('x'))).toBe(false);
    expect(isHttpError('x')).toBe(false);
  });

  it('keeps a stable name for logging', () => {
    expect(new UnauthorizedError('x').name).toBe('UnauthorizedError');
  });
});
