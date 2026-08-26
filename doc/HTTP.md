# HTTP client

A single configured **axios** instance shared by every repository, with an
interceptor chain for auth refresh, logging, and error mapping. Hand-written —
**no OpenAPI codegen**. The interceptor chain (auth-refresh handler, error
taxonomy, central logging) lives under `access/http/`, with the base URL coming
from the environment.

## Building the client

[`createHttpClient`](../src/access/http/createHttpClient.ts) returns a configured
`AxiosInstance`:

```ts
const http = createHttpClient({
  baseUrl: environment.getConfig().apiBaseUrl, // from EnvironmentService
  logger,                                       // request/response/error logging
  tokenProvider,                                // auth (a no-auth stub for now)
});
```

Repositories receive this instance by constructor injection and parse every
response with a zod schema at the boundary (throwing `ParseError` on failure —
see [Serialization.md](Serialization.md)). The real Dad Jokes repository consumes
this client (`HttpJokesRepository`).

Every request carries a descriptive **`User-Agent`** (`DEFAULT_USER_AGENT`,
overridable via `HttpClientDeps.userAgent`). This is good hygiene and is
**required** by some public APIs — the sample Dad Jokes source (Reddit)
rate-limits or blocks generic clients (`okhttp`, …) with `429`/`403`, so a real
project should set its own app id/version here.

## The interceptor chain

Registration order is load-bearing — axios runs response interceptors in
registration order, so:

1. **auth refresh** (registered first) — stamps `Authorization`, and on the error
   path sees the raw 401 before anyone maps it.
2. **logging** — logs request / successful response through the `Logger`; silent
   above `debug`. Each log line is tagged `category: 'network'` (see
   [`LogCategory`](../src/access/logger/LogCategory.ts)) so the in-app log console
   can filter to it.
3. **network inspector** — when a recorder is supplied (diagnostics on), captures
   the full request/response into the [`NetworkInspector`](../src/access/http/NetworkInspector.ts)
   store; see [the section below](#network-inspector). Registered before
   error-mapping so it still sees the raw `AxiosError` (with its `config`).
4. **error mapping** (registered last) — converts whatever escapes into the typed
   [error taxonomy](../src/access/http/errors.ts) and logs it (also
   `network`-tagged).

## Network inspector

When diagnostics is enabled, `createServices` builds an in-memory
[`InMemoryNetworkInspector`](../src/access/http/NetworkInspector.ts) and passes it
to `createHttpClient` as the capture recorder;
[`networkInspectorInterceptor`](../src/access/http/interceptors/networkInspectorInterceptor.ts)
records each exchange — method, URL, request/response **headers**, **payload**,
status, and **duration** — updating it in place from `pending` to
`success`/`failure`.

- **Capture is in-memory only** — bodies/headers are never written to the log
  file — size-capped, and **sensitive headers** (`Authorization`, `Cookie`, …)
  are redacted at capture.
- **Zero-cost in production**: the interceptor is wired only when a recorder is
  supplied, and the recorder exists only when `diagnosticsEnabled` (so
  `services.networkInspector` is `null` in production).
- Surfaced in the diagnostics overlay's dedicated **Network inspector** page
  (list → per-request detail); see [Diagnostics.md](Diagnostics.md).

## Auth refresh flow

Implemented in
[`authRefreshInterceptor`](../src/access/http/interceptors/authRefreshInterceptor.ts)
against the [`TokenProvider`](../src/access/http/TokenProvider.ts) interface:

1. On a `401`, if the request hasn't already been retried, trigger a refresh.
2. Refresh is **single-flight** — concurrent 401s coalesce onto one refresh call.
3. On success, retry the original request **once** with the new token.
4. If refresh yields no token, call `onSessionExpired()` and reject with
   `UnauthorizedError`.

The app ships a `MockTokenProvider` (no-auth) so the client works for the
unauthenticated sample API while the flow stays fully exercised by tests.

## Testing

[`httpClient.test.ts`](../test/access/http/httpClient.test.ts) drives the client
against **MSW** (a throwaway endpoint, no feature repo): success, `ServerError`,
`NetworkError`, the refresh-and-retry happy path, the refresh-failure →
`UnauthorizedError` path, and single-flight coalescing of concurrent 401s.

See [ErrorHandling.md](ErrorHandling.md) for the error taxonomy this feeds.
