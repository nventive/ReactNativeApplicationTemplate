# Crash & session reporting

Crash and session reporting through a single Access seam. The app ships
**Bugsee for internal builds only** — it is billed per user, so it is only worth
running on internal distribution builds, never production.

The same seam is the drop-in point for a project's **production** crash reporter
(typically Firebase Crashlytics), which is **out of template scope** — a project
adds it at this one boundary without threading a vendor SDK through the app.

## The contract

[`CrashReporter`](../src/access/crashReporting/CrashReporter.ts) — modeled on the
[`AnalyticsSink`](Analytics.md) seam:

```ts
interface CrashReporter {
  readonly isEnabled: boolean;
  recordError(error: unknown, context?: Record<string, unknown>): void; // handled/unhandled
  recordEvent(name: string, properties?: Record<string, unknown>): void; // session breadcrumb
  setAttribute(key: string, value: string | number | boolean): void;     // report attribute
}
```

| Implementation | Role |
|----------------|------|
| [`NoopCrashReporter`](../src/access/crashReporting/NoopCrashReporter.ts) | **default** — reporting off; carries no SDK, so production/store builds pay nothing. Still forwards errors to the `Logger`. |
| [`BugseeCrashReporter`](../src/access/crashReporting/BugseeCrashReporter.ts) | wraps Bugsee via [`BugseeGateway`](../src/access/crashReporting/BugseeGateway.ts); launches a session and forwards calls. Active only on internal builds with a valid token. |
| [`RecordingCrashReporter`](../src/access/crashReporting/RecordingCrashReporter.ts) | records calls for tests. |

Only [`NativeBugseeGateway`](../src/access/crashReporting/NativeBugseeGateway.ts)
imports the Bugsee SDK; it loads lazily and reports `isAvailable = false` when the
optional package is absent (the default template state).

## The gate — internal builds only, never production

[`resolveCrashReporter`](../src/access/crashReporting/BugseeCrashReporter.ts) is
the single decision point. Reporting runs **only** when all hold:

1. **`crashReportingEnabled`** for the environment — `true` for dev/staging,
   **`false` for production** ([environments.ts](../src/business/environment/environments.ts)).
   Production always gets the no-op reporter.
2. **A valid token** — the build-injected token passes the GUID
   [`BUGSEE_TOKEN_FORMAT`](../src/access/crashReporting/bugseeToken.ts) check. A
   missing/placeholder token (what the repo ships) ⇒ no-op.
3. **The SDK is installed** — otherwise the reporter degrades to a disabled no-op.

This is **double-gated**: even if an environment flag were wrong, CI injects a
token only for internal lanes, so production stays off.

## What is wired

- **Unhandled UI errors** — [`ConnectedErrorBoundary`](../src/presentation/shell/ConnectedErrorBoundary.tsx)
  calls `recordError` on a render-phase crash, alongside the `fatal` log.
- **Environment attribute** — the composition root tags reports with the active
  environment.
- **Diagnostics** — the [crash-reporting section](Diagnostics.md) shows whether
  reporting is active and offers a **"log a test exception"** button on internal
  builds, so a build can be verified against the Bugsee dashboard.

## Wiring (opt-in, keeps the default bundle SDK-free)

Like Firebase, the composition root never imports the Bugsee gateway. Activate it
from the app entry with the opt-in factory:

```ts
// src/app/App.tsx — after installing react-native-bugsee
import { platformIntegrationOverrides } from '../framework/composition/platformIntegrations';

const services = createServices(platformIntegrationOverrides());
```

## Activation steps

1. `yarn add react-native-bugsee` (iOS also needs `pod install`; see the Bugsee
   RN docs — and add the `PrivacyInfo.xcprivacy` Podfile tweak if archiving
   flags it).
2. Wire the reporter in `App.tsx` (snippet above).
3. Provide the platform tokens **at build time** (never committed):
   `BUGSEE_IOS_TOKEN` / `BUGSEE_ANDROID_TOKEN`. `app.config.ts` surfaces them
   through `extra.bugsee`; [`getBugseeToken`](../src/access/crashReporting/bugseeToken.ts)
   reads the current platform's.
4. Build an **internal** (dev/staging) release and confirm a test exception from
   the diagnostics overlay reaches your Bugsee dashboard.

## Secrets — tokens are never committed

The Bugsee app token is a client token embedded in the binary by nature (not a
server secret), but it is still kept out of this public repo:

- The repo commits **no token** — `BUGSEE_IOS_TOKEN` / `BUGSEE_ANDROID_TOKEN` are
  unset, so `getBugseeToken()` returns `undefined` and reporting is off.
- **CI injects** the tokens as secret pipeline variables **for internal lanes
  only** — the production lane gets none, so the GUID check fails and Bugsee never
  launches there (a Bugsee variable group per lane). See
  [AzurePipelines.md](AzurePipelines.md).

## Production crash reporting (Crashlytics) — the per-project seam

Firebase Crashlytics (or any production reporter) is added per project by writing
a `CrashlyticsCrashReporter implements CrashReporter` and selecting it at the
composition root for production builds — no call site changes, because every error
already flows through `CrashReporter`. Keeping it behind this seam is why the
vendor SDK never leaks into Business/Presentation.

## Testing

The seam, gating, and no-op path are covered by Tier-1 tests
([`CrashReporter.test.ts`](../test/access/crashReporting/CrashReporter.test.ts),
[`NativeBugseeGateway.test.ts`](../test/access/crashReporting/NativeBugseeGateway.test.ts)).
The native Bugsee integration and the end-to-end "test crash appears in the
dashboard" flow must be verified on a real internal build with the SDK installed.
