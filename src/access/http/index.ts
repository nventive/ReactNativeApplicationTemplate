/**
 * Public surface of the HTTP Access module. Repositories import `createHttpClient`
 * (usually receive the instance by injection) and the error taxonomy from here.
 */
export { createHttpClient, DEFAULT_USER_AGENT, type HttpClientDeps } from './createHttpClient';
export {
  HttpError,
  NetworkError,
  ServerError,
  ParseError,
  UnauthorizedError,
  isHttpError,
  toHttpError,
  type HttpErrorKind,
} from './errors';
export { type TokenProvider, MockTokenProvider } from './TokenProvider';
