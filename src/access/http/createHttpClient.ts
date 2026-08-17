import axios, { type AxiosInstance } from 'axios';

import type { Logger } from '../logger/Logger';
import { registerAuthRefreshInterceptor } from './interceptors/authRefreshInterceptor';
import { registerErrorMappingInterceptor } from './interceptors/errorMappingInterceptor';
import { registerLoggingInterceptor } from './interceptors/loggingInterceptor';
import { registerNetworkInspectorInterceptor } from './interceptors/networkInspectorInterceptor';
import type { NetworkRecorder } from './NetworkInspector';
import type { TokenProvider } from './TokenProvider';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Default `User-Agent` identifying the app on every outgoing request.
 *
 * A descriptive, non-generic UA is required by some public APIs: the sample Dad
 * Jokes source (Reddit) rate-limits or blocks generic clients (e.g. `okhttp`)
 * with `429`/`403`, so without this the real repository would surface errors on
 * device. Reddit is also picky about the *exact* string — it rejects many UAs
 * while accepting others — so this uses a specific value known to work against
 * Reddit. Override per build via `HttpClientDeps.userAgent` (a real project sets
 * its own app id / version).
 */
export const DEFAULT_USER_AGENT = 'DadJokesApp/1.0.0';

export interface HttpClientDeps {
  /** Base URL — comes from `EnvironmentService.getConfig().apiBaseUrl`. */
  baseUrl: string;
  /** Logger for request/response/error logging. */
  logger: Logger;
  /** Supplies/refreshes the auth token (a no-auth stub by default). */
  tokenProvider: TokenProvider;
  /** Request timeout; defaults to 30s. */
  timeoutMs?: number;
  /** Whether to attach the request/response logging interceptor (default true). */
  enableLogging?: boolean;
  /**
   * Optional network-inspector recorder. When supplied (diagnostics on), a
   * capture interceptor records each exchange (headers/body/timing) for the
   * in-app inspector; omitted, nothing is captured (zero-cost in production).
   */
  networkRecorder?: NetworkRecorder;
  /** `User-Agent` sent on every request; defaults to {@link DEFAULT_USER_AGENT}. */
  userAgent?: string;
}

/**
 * Builds the configured axios instance shared by every repository. Hand-written
 * (no OpenAPI codegen); repositories parse each response
 * with a zod schema at the boundary and throw `ParseError` on failure.
 *
 * Interceptor registration order is load-bearing (axios runs response
 * interceptors in registration order): auth-refresh first (recovers 401s),
 * then logging, then the network inspector (still sees the raw `AxiosError`),
 * then error-mapping last (maps whatever escapes to the typed taxonomy).
 */
export function createHttpClient(deps: HttpClientDeps): AxiosInstance {
  const client = axios.create({
    baseURL: deps.baseUrl,
    timeout: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    headers: {
      Accept: 'application/json',
      'User-Agent': deps.userAgent ?? DEFAULT_USER_AGENT,
    },
  });

  registerAuthRefreshInterceptor(client, deps.tokenProvider, deps.logger);
  if (deps.enableLogging ?? true) {
    registerLoggingInterceptor(client, deps.logger);
  }
  if (deps.networkRecorder) {
    registerNetworkInspectorInterceptor(client, deps.networkRecorder);
  }
  registerErrorMappingInterceptor(client, deps.logger);

  return client;
}
