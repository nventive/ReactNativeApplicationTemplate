# Kill switch

Remotely disables the app behind a message screen while a server-side flag is
active, and **recovers automatically** when it lifts. Together
with [forced update](ForcedUpdate.md) it is the template's remote-intervention
story (there are no OTA updates).

## How it works

- The kill flag comes from the
  [`RemoteConfigProvider`](../src/access/remoteConfig/RemoteConfigProvider.ts)
  (`killSwitchActive`) — see [RemoteConfig.md](RemoteConfig.md).
- [`DefaultKillSwitchService`](../src/business/killSwitch/DefaultKillSwitchService.ts)
  derives `isKillSwitchActive$` from it (a thin `map` + `distinctUntilChanged` —
  plain pass-through logic, no UI).
- The [`AppGate`](../src/presentation/shell/AppGate.tsx) shows the message-only
  [`KillSwitchScreen`](../src/presentation/killSwitch/KillSwitchScreen.tsx) while
  the flag is active, and returns to the app when it clears.

Because the gate is observable-driven, **recovery is free**: clearing the remote
flag re-renders the app with no navigation bookkeeping (the previous tree simply
reappears). Forced update takes precedence — if both fire, the update screen wins.

## Behavior

- **Trigger** — `RemoteConfigProvider.killSwitchActive`.
- **Screen** — `KillSwitchScreen` (message only, no controls).
- **Recovery** — `AppGate` re-renders the app when the flag is `false`.
- **Precedence** — forced update wins in `AppGate`.

## Triggering it without a backend

With mocking on (dev default), the diagnostics overlay's **Toggle kill switch**
button flips the flag on the
[`MockRemoteConfigProvider`](../src/access/remoteConfig/MockRemoteConfigProvider.ts).
The overlay is mounted *outside* the gate, so it stays reachable while the kill
screen is showing — that is how you toggle the flag back off. See
[Diagnostics.md](Diagnostics.md).

## Testing

- Tier 1: [`DefaultKillSwitchService.test.ts`](../test/business/killSwitch/DefaultKillSwitchService.test.ts)
  (reflect + recover + distinct).
- Integration: [`operational.integration.test.ts`](../test/integration/operational.integration.test.ts).
- Tier 2: [`AppGate.test.tsx`](../test/presentation/shell/AppGate.test.tsx)
  (block + recovery + precedence).
