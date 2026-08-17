import type { AxiosInstance } from 'axios';

import { LOG_CATEGORY_KEY, NETWORK_LOG_CATEGORY } from '../../logger/LogCategory';
import type { Logger } from '../../logger/Logger';

/**
 * Logs each request and successful response through the injected `Logger`.
 * Failures are logged by the error-mapping interceptor, so this one only rethrows
 * on the error path to avoid double logging.
 *
 * Each entry is tagged with the `network` category and structured meta
 * (method / url / status / duration), so the in-app log console can surface an
 * HTTP inspector view. No separate capture store: the shared `Logger` already sees
 * every request.
 *
 * Kept at `debug` level so it is silent in staging/production (where the
 * minimum level is higher); the in-app console therefore shows full HTTP detail
 * in development and error-level failures elsewhere.
 */
export function registerLoggingInterceptor(client: AxiosInstance, logger: Logger): void {
  const startTimes = new WeakMap<object, number>();

  client.interceptors.request.use((config) => {
    startTimes.set(config, Date.now());
    const method = config.method?.toUpperCase() ?? 'GET';
    logger.debug(`HTTP → ${method} ${config.url ?? ''}`, {
      [LOG_CATEGORY_KEY]: NETWORK_LOG_CATEGORY,
      method,
      url: config.url,
    });
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      const start = startTimes.get(response.config);
      const durationMs = start !== undefined ? Date.now() - start : undefined;
      const suffix = durationMs !== undefined ? ` (${durationMs}ms)` : '';
      const method = response.config.method?.toUpperCase() ?? 'GET';
      logger.debug(`HTTP ← ${response.status} ${response.config.url ?? ''}${suffix}`, {
        [LOG_CATEGORY_KEY]: NETWORK_LOG_CATEGORY,
        method,
        url: response.config.url,
        status: response.status,
        durationMs,
      });
      return response;
    },
    (error) => Promise.reject(error),
  );
}
