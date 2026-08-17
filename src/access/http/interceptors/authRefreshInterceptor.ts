import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import type { Logger } from '../../logger/Logger';
import { UnauthorizedError } from '../errors';
import type { TokenProvider } from '../TokenProvider';

type RetryableConfig = InternalAxiosRequestConfig & { _isRetry?: boolean };

/**
 * Stamps the bearer token on outgoing requests and drives the
 * 401 → refresh → retry-once flow.
 *
 * A module-closure `refreshPromise` makes refresh **single-flight**: concurrent
 * 401s share one refresh call. A request is retried at most once (`_isRetry`);
 * if refresh yields no token, `onSessionExpired` fires and the request rejects
 * with `UnauthorizedError`.
 *
 * Registered **first** so its response handler sees the raw 401 before the
 * error-mapping interceptor.
 */
export function registerAuthRefreshInterceptor(
  client: AxiosInstance,
  tokenProvider: TokenProvider,
  logger: Logger,
): void {
  let refreshPromise: Promise<string | null> | null = null;

  client.interceptors.request.use(async (config) => {
    const token = await tokenProvider.getToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error?.config as RetryableConfig | undefined;
      const status = error?.response?.status as number | undefined;

      if (status !== 401 || !config) {
        return Promise.reject(error);
      }

      if (config._isRetry) {
        tokenProvider.onSessionExpired();
        return Promise.reject(new UnauthorizedError('Session expired', error));
      }
      config._isRetry = true;

      // Assigned synchronously (no await before this line) so concurrent 401s
      // coalesce onto one refresh.
      if (!refreshPromise) {
        refreshPromise = refresh(tokenProvider).finally(() => {
          refreshPromise = null;
        });
      }

      try {
        const newToken = await refreshPromise;
        if (!newToken) {
          tokenProvider.onSessionExpired();
          return Promise.reject(new UnauthorizedError('Session expired', error));
        }
        config.headers.set('Authorization', `Bearer ${newToken}`);
        logger.debug('HTTP retrying request after token refresh');
        return client(config);
      } catch (refreshError) {
        tokenProvider.onSessionExpired();
        return Promise.reject(new UnauthorizedError('Session expired', refreshError));
      }
    },
  );
}

async function refresh(tokenProvider: TokenProvider): Promise<string | null> {
  const current = await tokenProvider.getToken();
  return tokenProvider.refreshToken(current);
}
