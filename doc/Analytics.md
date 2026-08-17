# Analytics

A single Access-layer seam every screen view and domain event flows through, so a
real provider (Firebase Analytics / Segment) drops in at one boundary. This is the
same seam pattern used for [crash reporting](CrashReporting.md).

## The contract

[`AnalyticsSink`](../src/access/analytics/AnalyticsSink.ts):

```ts
interface AnalyticsSink {
  trackScreenView(screenName: string, params?: Record<string, unknown>): void;
  trackEvent(name: string, properties?: Record<string, unknown>): void;
}
```

| Implementation | Role |
|----------------|------|
| [`LoggingAnalyticsSink`](../src/access/analytics/LoggingAnalyticsSink.ts) | **default** — sends nowhere, logs each call through the `Logger` (visibility without a backend) |
| [`RecordingAnalyticsSink`](../src/access/analytics/RecordingAnalyticsSink.ts) | records calls for tests |
| _vendor sink_ | swap in at [`createServices.ts`](../src/framework/composition/createServices.ts) — one line, no call-site changes |

## What is tracked

- **Screen views** — [`NavigationRoot`](../src/presentation/navigation/NavigationRoot.tsx)
  reports the active route name on every navigation change.
- **Domain events** — [`DefaultJokesService`](../src/business/jokes/DefaultJokesService.ts)
  reports `joke_favorited` (with the joke id and the new state) from the Business
  layer, through the interface only. Adding an event is a `trackEvent` call in the
  relevant Business/Presentation unit.

The sink is injected by constructor (Business) or read from `useServices()`
(Presentation) — a vendor SDK is never imported outside its sink implementation.

## Testing

`joke_favorited` is asserted in
[`DefaultJokesService.test.ts`](../test/business/jokes/DefaultJokesService.test.ts)
with the `RecordingAnalyticsSink`; the sink interface keeps every tracking call
Tier-1 verifiable.
