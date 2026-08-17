# Diagnostics overlay

A bespoke in-app overlay — **usable in release builds** — for switching
environments, viewing logs, toggling mock data, and driving the operational
features. It is the home of the [mocking toggle](#mocking-toggle).

## Availability & dismissal

Availability is governed by
[`DiagnosticsService`](../src/business/diagnostics/DiagnosticsService.ts), which
combines three tiers:

| Tier | Source | Scope |
|------|--------|-------|
| Environment default | `environment.getConfig().diagnosticsEnabled` (off in **production**) | build-time default |
| Permanent disable | persisted flag (MMKV) via **Disable diagnostics** | survives relaunch (clear storage / reinstall to undo) |
| Session dismissal | in-memory via **Hide for this session** | until next launch |

When available, a floating launcher pill
([`DiagnosticsHost`](../src/presentation/diagnostics/DiagnosticsHost.tsx)) is
shown over the whole app; tapping it opens the full-screen
[`DiagnosticsPanel`](../src/presentation/diagnostics/DiagnosticsPanel.tsx). The
host is mounted **outside** [`AppGate`](../src/presentation/shell/AppGate.tsx),
so the launcher stays reachable during a forced-update / kill-switch block — the
only way to toggle those mock flags back.

## Sections

| Section | Drives | Notes |
|---------|--------|-------|
| [App info](../src/presentation/diagnostics/AppInfoSection.tsx) | `AppInfoRepository` | shows the build's name, version, native build number, bundle id, and the device's platform / OS version (read-only) — the fields you need when triaging a report off an unknown device; the version comes from GitVersion in CI ([AzurePipelines.md](AzurePipelines.md)) |
| [Theme](../src/presentation/diagnostics/ThemeSection.tsx) | `ThemeProvider` (`useThemeMode`) | **System / Light / Dark** switch; **applies immediately** (no restart) ([DesignSystem.md](DesignSystem.md)) |
| [Environment](../src/presentation/diagnostics/EnvironmentSection.tsx) | `EnvironmentService` | picks dev/staging/prod; **restart to apply** banner while pending ([Environment.md](Environment.md)) |
| [Mock data](../src/presentation/diagnostics/MockingSection.tsx) | `MockingService` | the real-vs-mock toggle; **restart to apply** |
| [Remote config](../src/presentation/diagnostics/RemoteConfigSection.tsx) | `RemoteConfigController` | **Force an update** / **Toggle kill switch** — only shown with mocking on |
| [Crash reporting](../src/presentation/diagnostics/CrashReportingSection.tsx) | `CrashReporter` | shows whether Bugsee is active; **Log a test exception** on internal builds ([CrashReporting.md](CrashReporting.md)) |
| [Logging](../src/presentation/diagnostics/LoggingSection.tsx) | `LoggingService` + `LogFileReader` + `Logger` + `FileSharer` | **Console/File logging** toggles (**restart to apply**); generate test logs; **share the actual `.log` file** (via `getUri()` + expo-sharing, not the log text) / clear it ([Logging.md](Logging.md)) |
| Tools | (navigation) | links to the two dedicated **pages** below, so neither crowds the panel with a large scroll area |

The environment, mocking, and logging switches follow the **restart-required**
pattern: they persist immediately but apply on next launch (all feed
construction-time dependencies read once by the composition root), showing a red
banner until then. "Console logging" is the native console sink (Metro /
`adb logcat` / Xcode) — the logs read over USB with the device plugged in.

### Dedicated pages

The overlay is mounted **outside** the React Navigation tree (so it stays
reachable during a block), so it runs its own tiny page stack in
[`DiagnosticsHost`](../src/presentation/diagnostics/DiagnosticsHost.tsx) — the
panel plus two full-screen pages (list/detail), all built on the shared
[`DiagnosticsScreen`](../src/presentation/diagnostics/DiagnosticsScreen.tsx)
chrome. List and detail are real full-screen pages rather than height-capped
inline panels.

| Page | Drives | Notes |
|------|--------|-------|
| [Log console](../src/presentation/diagnostics/LogConsoleScreen.tsx) | `LogBufferReader` | live on-device log list, filterable by level or the **network** category — works in a signed staging build ([Logging.md](Logging.md)) |
| [Network inspector](../src/presentation/diagnostics/NetworkInspectorScreen.tsx) → [detail](../src/presentation/diagnostics/NetworkDetailScreen.tsx) | `NetworkInspector` | captured HTTP exchanges (list → per-request **headers / payload / duration**) ([HTTP.md](HTTP.md)) |

## Mocking toggle

Runtime selection between real and mock Access implementations, persisted in
MMKV. [`resolveMockingEnabled`](../src/business/mocking/DefaultMockingService.ts)
resolves the effective flag at startup — **mocks in development, real
elsewhere**, overridden by the persisted value once the user toggles it. The
composition root reads it once and wires the mock or real
[jokes repository](DadJokes.md) *and* the mock or static
[remote-config provider](RemoteConfig.md) from it, so "mocking on" also lights up
the remote-config triggers above. With mocks enabled the app runs fully offline.

[`DefaultMockingService`](../src/business/mocking/DefaultMockingService.ts) holds
the toggle and raises `hasPendingChange$` once it differs from the value the
running graph was built with (the "restart to apply" banner). It never re-wires
the live graph.

## Testing

- Tier 1: [`DefaultDiagnosticsService.test.ts`](../test/business/diagnostics/DefaultDiagnosticsService.test.ts)
  (availability tiers) and [`DefaultMockingService.test.ts`](../test/business/mocking/DefaultMockingService.test.ts)
  (persist + pending + startup resolver).
- Tier 2: [`DiagnosticsOverlay.test.tsx`](../test/presentation/diagnostics/DiagnosticsOverlay.test.tsx)
  (open panel, env picker, mocking toggle, logging toggle, the dedicated log
  console + network filter, the network inspector list → detail drill-in,
  kill-switch trigger, dismissal).
- Tier 1: [`InMemoryLogTransport.test.ts`](../test/access/logger/InMemoryLogTransport.test.ts)
  (log ring buffer), [`DefaultLoggingService.test.ts`](../test/business/logging/DefaultLoggingService.test.ts)
  (toggle resolver + restart banner), and [`NetworkInspector.test.ts`](../test/access/http/NetworkInspector.test.ts)
  (capture store). [`networkLogging.test.ts`](../test/access/http/networkLogging.test.ts)
  proves HTTP log lines carry the `network` category;
  [`networkInspectorCapture.test.ts`](../test/access/http/networkInspectorCapture.test.ts)
  proves the interceptor captures headers/payload/duration and redacts secrets.
