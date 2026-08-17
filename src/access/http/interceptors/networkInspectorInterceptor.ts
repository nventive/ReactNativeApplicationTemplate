import axios, { type AxiosError, type AxiosInstance } from 'axios';

import { toHttpError } from '../errors';
import type { NetworkRecorder } from '../NetworkInspector';

/** Cap each captured body so the in-memory inspector can't grow unbounded. */
const MAX_BODY_CHARS = 20_000;

/** Header names whose values are redacted before capture (never shown in-app). */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
]);

/**
 * Captures every request/response into the {@link NetworkRecorder} backing the
 * in-app network inspector. It records the request when it leaves (`begin`), then
 * fills in the response or
 * failure in place (matched by a per-`config` id), so a slow request shows as
 * pending until it resolves.
 *
 * Registered **before** the error-mapping interceptor so, on the error path, it
 * still sees the raw `AxiosError` (with its `config`) rather than the mapped
 * taxonomy error. Wired only when a recorder is supplied (diagnostics on), so it
 * is zero-cost in production.
 */
export function registerNetworkInspectorInterceptor(
  client: AxiosInstance,
  recorder: NetworkRecorder,
): void {
  // Correlates a request config with its captured exchange id; retries reuse the
  // same config object, so they update the same exchange rather than duplicating.
  const ids = new WeakMap<object, string>();

  client.interceptors.request.use((config) => {
    if (!ids.has(config)) {
      const id = recorder.begin({
        method: (config.method ?? 'get').toUpperCase(),
        url: config.url ?? '',
        headers: redactHeaders(headersToRecord(config.headers)),
        requestBody: stringifyBody(config.data),
      });
      ids.set(config, id);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      const id = ids.get(response.config);
      if (id !== undefined) {
        recorder.complete(id, {
          status: response.status,
          headers: redactHeaders(headersToRecord(response.headers)),
          responseBody: stringifyBody(response.data),
        });
      }
      return response;
    },
    (error: unknown) => {
      const axiosError = extractAxiosError(error);
      const id = axiosError?.config ? ids.get(axiosError.config) : undefined;
      if (id !== undefined) {
        recorder.fail(id, {
          status: axiosError?.response?.status,
          headers: axiosError?.response
            ? redactHeaders(headersToRecord(axiosError.response.headers))
            : undefined,
          responseBody: axiosError?.response ? stringifyBody(axiosError.response.data) : undefined,
          errorKind: toHttpError(error).kind,
        });
      }
      return Promise.reject(error);
    },
  );
}

/**
 * The `AxiosError` carrying the request `config`, whether the rejection is the
 * raw error or a taxonomy error that wrapped it as `cause` (e.g. the
 * auth-refresh interceptor's `UnauthorizedError`).
 */
function extractAxiosError(error: unknown): AxiosError | undefined {
  if (axios.isAxiosError(error)) {
    return error;
  }
  if (error !== null && typeof error === 'object' && 'cause' in error) {
    const cause = (error as { cause: unknown }).cause;
    if (axios.isAxiosError(cause)) {
      return cause;
    }
  }
  return undefined;
}

/** Normalizes axios headers (AxiosHeaders or a plain object) to a string record. */
function headersToRecord(headers: unknown): Record<string, string> {
  if (headers === null || typeof headers !== 'object') {
    return {};
  }
  const source =
    typeof (headers as { toJSON?: unknown }).toJSON === 'function'
      ? (headers as { toJSON: () => Record<string, unknown> }).toJSON()
      : (headers as Record<string, unknown>);
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === null || value === undefined) {
      continue;
    }
    record[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return record;
}

/** Replaces sensitive header values with a placeholder. */
function redactHeaders(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '***' : value;
  }
  return out;
}

/** Serializes a request/response body to a capped string, or undefined if empty. */
function stringifyBody(data: unknown): string | undefined {
  if (data === null || data === undefined) {
    return undefined;
  }
  let text: string;
  if (typeof data === 'string') {
    text = data;
  } else {
    try {
      text = JSON.stringify(data);
    } catch {
      text = String(data);
    }
  }
  if (text.length === 0) {
    return undefined;
  }
  return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}…(truncated)` : text;
}
