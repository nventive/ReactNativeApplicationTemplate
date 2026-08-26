# Error handling

The app-wide error model: a typed taxonomy produced at the Access boundary,
a screen-level convention for rendering loading/error states, and an app-shell
error boundary. Built on top of the HTTP client's error mapping (see
[HTTP.md](HTTP.md)). The doctrine: *repositories throw typed errors, screens
branch on type, don't catch-to-toast in business.*

## The taxonomy

[`src/access/http/errors.ts`](../src/access/http/errors.ts) defines a small class
hierarchy under `HttpError` (each carries a `kind` for exhaustive `switch`es and
survives `instanceof` across Metro/Hermes down-leveling):

| Error | `kind` | Produced when |
|-------|--------|---------------|
| `NetworkError` | `network` | No response — offline, DNS, timeout |
| `ServerError` (has `status`, `body`) | `server` | A non-2xx response that isn't an unrecovered auth failure |
| `ParseError` (has `issues`) | `parse` | A 2xx body fails zod/JSON decoding |
| `UnauthorizedError` | `unauthorized` | A 401 that survived refresh + retry |

- The **error-mapping interceptor** produces `NetworkError` / `ServerError` /
  `UnauthorizedError` from `AxiosError`s (`toHttpError`).
- **Repositories** produce `ParseError` from zod failures at the boundary.
- `isHttpError(e)` is the guard. The error-mapping interceptor logs the errors it
  produces (`NetworkError` / `ServerError` / `UnauthorizedError`) through the
  `Logger`; `ParseError` is thrown by the repository and surfaces to the screen
  via `QueryStateView` (below).

## Screen-level loading/error convention

Screens render fetched state through
[`QueryStateView`](../src/presentation/components/QueryStateView.tsx), which pairs
loading and error states (the "async data loading" concern) and branches on the
taxonomy — `NetworkError` gets offline copy, everything else a generic message:

```tsx
<QueryStateView query={jokesQuery}>
  {(jokes) => <FlatList data={jokes} … />}
</QueryStateView>
```

It renders a spinner while pending, a typed error view with a retry action on
failure, or the data. Live business state (RxJS) is separate — that is the
`useObservable` bridge, not this.

## App-shell error boundary

[`ConnectedErrorBoundary`](../src/presentation/shell/ConnectedErrorBoundary.tsx)
wraps the tree just inside the providers and logs any render-phase crash at
`fatal` through the `Logger` before showing a recoverable fallback. Async/fetch
errors are React Query's job (`QueryStateView`), not the boundary's.

```
SafeAreaProvider → ThemeProvider → ServicesProvider → QueryClientProvider
  → ConnectedErrorBoundary → DiagnosticsHost → AppGate
  → NavigationRoot (NavigationContainer) → screens
```
