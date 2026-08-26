# Forced update

Blocks an out-of-date app until the user updates from the store. It is one half of
the app's remote-intervention story (the other is the
[kill switch](KillSwitch.md)); there are no OTA updates.

## How it works

Three pieces, wired in [`createServices.ts`](../src/framework/composition/createServices.ts):

1. **Remote minimum version** comes from the
   [`RemoteConfigProvider`](../src/access/remoteConfig/RemoteConfigProvider.ts)
   (`minimumVersion`) — see [RemoteConfig.md](RemoteConfig.md). Mock-driven by
   default; backed by real Firebase when enabled.
2. **Installed version** comes from the
   [`CurrentVersionRepository`](../src/access/appInfo/CurrentVersionRepository.ts)
   (Access interface; the Expo implementation reads `app.config.ts`'s `version`
   through expo-constants).
3. [`DefaultForcedUpdateService`](../src/business/forcedUpdate/DefaultForcedUpdateService.ts)
   combines them and exposes `isUpdateRequired$` — `true` whenever
   `installed < minimum`, using the correctness-critical
   [`compareVersions`](../src/access/version/Version.ts) rules (`major.minor.patch[.build]`,
   a missing build sorts before any concrete build).

The [`AppGate`](../src/presentation/shell/AppGate.tsx) subscribes and, while an
update is required, renders the blocking
[`ForcedUpdateScreen`](../src/presentation/forcedUpdate/ForcedUpdateScreen.tsx)
**instead of** the app (outside the navigator — no back, no tabs). The update
button opens the platform store URL
(`environment.getConfig().appStoreUrl.{ios,android}`) through the injected
[`UrlLauncher`](../src/access/native/UrlLauncher.ts); a launch failure surfaces
the localized `forcedUpdate.urlLaunchError` inline.

## Behavior

- **Trigger** — `RemoteConfigProvider.minimumVersion`.
- **Compare** — `compareVersions` (`installed < minimum`).
- **Presentation** — `AppGate` swaps the whole tree (no back, no tabs).
- **Recovery** — the gate is **observable**: it lifts if the minimum drops.
- **Precedence** — forced update > kill switch, enforced by `AppGate`.

Because the gate is observable-driven rather than one-shot, lowering the remote
minimum (e.g. from the diagnostics trigger) lifts the block — the deliberate
"lifts when the flag clears" behavior.

## Triggering it without a backend

With mocking on (dev default), the diagnostics overlay's **Force an update**
button ([RemoteConfigSection](../src/presentation/diagnostics/RemoteConfigSection.tsx))
pushes a very high `minimumVersion` into the
[`MockRemoteConfigProvider`](../src/access/remoteConfig/MockRemoteConfigProvider.ts);
**Clear forced update** resets it. See [Diagnostics.md](Diagnostics.md).

## Testing

- Tier 1: [`DefaultForcedUpdateService.test.ts`](../test/business/forcedUpdate/DefaultForcedUpdateService.test.ts)
  (block / no-block / recovery) and [`Version.test.ts`](../test/access/version/Version.test.ts)
  (compare rules).
- Integration: [`operational.integration.test.ts`](../test/integration/operational.integration.test.ts)
  drives it through the real graph.
- Tier 2: [`AppGate.test.tsx`](../test/presentation/shell/AppGate.test.tsx)
  (blocking + precedence).
