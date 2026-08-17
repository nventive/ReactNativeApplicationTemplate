import type { AxiosInstance } from 'axios';

import { LOG_CATEGORY_KEY, NETWORK_LOG_CATEGORY } from '../../logger/LogCategory';
import type { Logger } from '../../logger/Logger';
import { toHttpError } from '../errors';

/**
 * Converts any rejected request into the typed error taxonomy and logs it, so
 * callers above Access never see a raw `AxiosError`. Registered **last** so, on
 * the error path, it runs after the auth-refresh interceptor has had its chance
 * to recover a 401 (axios runs response interceptors in registration order).
 *
 * The entry is tagged with the `network` category (like the request/response
 * logs) so a failed request shows up in the in-app console's HTTP inspector view.
 */
export function registerErrorMappingInterceptor(client: AxiosInstance, logger: Logger): void {
  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const mapped = toHttpError(error);
      const url =
        typeof error === 'object' && error !== null && 'config' in error
          ? (error as { config?: { url?: string } }).config?.url
          : undefined;
      logger.error(`HTTP request failed (${mapped.kind})`, mapped, {
        [LOG_CATEGORY_KEY]: NETWORK_LOG_CATEGORY,
        ...(url ? { url } : {}),
      });
      return Promise.reject(mapped);
    },
  );
}
