# Logging

A `Logger` interface with pluggable transports, injected everywhere logging is
needed — there is **no global `console.log` in app code**. It combines a level
filter with multi-output transports.

## The interface

[`Logger`](../src/access/logger/Logger.ts) has per-level methods `t/d/i/w/e/f`:

```ts
logger.debug('HTTP → GET /top.json');
logger.warn('retrying after refresh', error);
logger.error('request failed', error, { url });
```

Levels are `trace < debug < info < warn < error < fatal`
([`LogLevel`](../src/access/logger/LogLevel.ts)); `parseLogLevel` also tolerates
the alternate spelling `'warning'`.

[`MockLogger`](../src/access/logger/MockLogger.ts) is the in-memory `Logger` test
double — it records every entry (no level filter) for Tier-1 assertions ("this
service logged a warning with the mapped error").

## Transports

A transport is a sink. The app fans an already
level-filtered entry out to every registered transport.

| Transport | Backed by | Notes |
|-----------|-----------|-------|
| [`ConsoleTransport`](../src/access/logger/ConsoleTransport.ts) | `console.*` | The one place console is used; routes by level. The **native** logs read over USB (Metro / `adb logcat` / Xcode) |
| [`FileTransport`](../src/access/logger/FileTransport.ts) | a `FileSystemGateway` | Retrievable log file (the diagnostics viewer reads/shares it) |
| [`InMemoryLogTransport`](../src/access/logger/InMemoryLogTransport.ts) | a bounded RxJS `BehaviorSubject` ring buffer | Backs the **in-app log console** + network inspector; attached when diagnostics is enabled |

[`CompositeLogger`](../src/access/logger/CompositeLogger.ts) applies the level
filter once, then fans out — and **guards each transport** so a misbehaving sink
can never crash the caller (logging is best-effort).

## File logging without a native dependency

`FileTransport` depends only on the
[`FileSystemGateway`](../src/access/logger/FileSystemGateway.ts) interface, so it
carries no native import and is fully Tier-1 testable:

- [`ExpoFileSystemGateway`](../src/access/logger/ExpoFileSystemGateway.ts) — the
  only file that imports expo-file-system.
- `InMemoryFileSystemGateway` — a `Map`, injected in tests.

expo-file-system has no atomic append, so `FileTransport` **buffers** each line
and drains a batch in a single read-modify-write serialized onto a promise chain
— a burst of writes collapses into one filesystem round-trip instead of one per
line. Every flush caps the file at `DEFAULT_MAX_LOG_FILE_BYTES` (2 MiB),
dropping the oldest whole lines past the limit — the on-disk analogue of the
in-memory buffer's ring trim, so `application.log` can never grow unbounded.
`FileTransport` also implements `LogFileReader` (`read()` / `getUri()` /
`clear()`) so the diagnostics log viewer can retrieve and export logs.
The viewer **shares the actual `.log` file** — it passes `getUri()` to the
[`FileSharer`](../src/access/native/FileSharer.ts) (expo-sharing), which opens the
OS share sheet with a real file attachment, rather than posting the log text as a
message (RN's core `Share` cannot attach a file on Android).

## In-app log console

The dedicated [`LogConsoleScreen`](../src/presentation/diagnostics/LogConsoleScreen.tsx)
(a page in the diagnostics overlay) renders the live `InMemoryLogTransport` buffer
newest-first, filterable by minimum level or by the **network** category — an
on-device log viewer that works in a signed staging build with no debugger
attached. The buffer holds entries
**after** the level filter, so it shows full `debug` detail in development and
higher-level entries elsewhere. HTTP log lines are tagged `category: 'network'`
(see [`LogCategory.ts`](../src/access/logger/LogCategory.ts)) so the **Network**
filter surfaces them.

For **rich HTTP detail** (headers, payload, timing) there is a separate network
inspector with its own capture store and detail page — see
[HTTP.md](HTTP.md) § Network inspector and [Diagnostics.md](Diagnostics.md). The
log console stays lightweight text; the file/console transports never carry
request/response bodies.

## Per-environment configuration & runtime toggles

[`createServices.ts`](../src/framework/composition/createServices.ts) builds the
logger from the active environment's config (see [Environment.md](Environment.md)):
which transports to attach (console/file) and the minimum level. Defaults —
dev: console+file at `debug`; staging: file at `info`; prod: file at `warn`.

The console/file selection can be overridden at runtime per device through the
[`LoggingService`](../src/business/logging/LoggingService.ts) (the
"Console logging" / "File logging" switches in the diagnostics overlay).
`resolveLoggingSettings` reads the persisted override over the environment default
once at startup — so, like the environment and mocking switches, a change persists
immediately but is **applied on restart** (the diagnostics section shows a
"restart to apply" banner until then). The in-app console buffer is independent of
both toggles, so it keeps capturing even with console and file logging off.

```ts
const { logger } = useServices(); // injected; never a bare console
```
