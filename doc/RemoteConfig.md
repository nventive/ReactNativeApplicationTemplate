# Remote configuration

The Access seam the operational features read remote, server-controlled values
from — currently the forced-update minimum version and the kill-switch flag. A
single provider covers both values.

The template builds **entirely against the interface** with a controllable mock,
so the app runs with no backend. The real
`@react-native-firebase/remote-config` implementation now exists as an
**opt-in** provider — see [FirebaseRemoteConfig.md](FirebaseRemoteConfig.md);
nothing above the Access boundary changes when a project wires it.

## The contract

[`RemoteConfigProvider`](../src/access/remoteConfig/RemoteConfigProvider.ts):

```ts
interface RemoteConfigProvider {
  readonly values$: Observable<RemoteConfigValues>; // BehaviorSubject-backed
  getValues(): RemoteConfigValues;
  refresh(): Promise<void>;                          // fetch/activate (no-op in the mock)
}
```

[`RemoteConfigValues`](../src/access/remoteConfig/RemoteConfig.ts) is the whole
schema the template needs — the two typed values and their remote-config wire keys:

| Typed value | Remote key | Default |
|-------------|------------|---------|
| `minimumVersion: Version` | `minimum_version` (string) | `1.0.0` |
| `killSwitchActive: boolean` | `is_kill_switch_active` (bool) | `false` |

Defaults are **safe** ([`REMOTE_CONFIG_DEFAULTS`](../src/access/remoteConfig/RemoteConfig.ts)):
they seed the initial values and never block the app before a fetch resolves. The
raw wire payload is parsed with `remoteConfigPayloadSchema` and mapped
fail-soft to the typed values (a malformed field falls back to its default —
[Serialization.md](Serialization.md)).

## Implementations

| Impl | When | Controllable |
|------|------|:------------:|
| [`MockRemoteConfigProvider`](../src/access/remoteConfig/MockRemoteConfigProvider.ts) | mocking on (dev default, or the [mocking toggle](Diagnostics.md)) | ✅ |
| [`StaticRemoteConfigProvider`](../src/access/remoteConfig/StaticRemoteConfigProvider.ts) | mocking off, Firebase not wired | ✕ |
| [`FirebaseRemoteConfigProvider`](../src/access/remoteConfig/FirebaseRemoteConfigProvider.ts) | mocking off, Firebase wired ([FirebaseRemoteConfig.md](FirebaseRemoteConfig.md)) | ✕ |

The mock also implements
[`RemoteConfigController`](../src/access/remoteConfig/RemoteConfigProvider.ts)
(`setMinimumVersion` / `setKillSwitchActive` / `toggleKillSwitch`). The
composition root exposes that surface as `remoteConfigController` **only when
mocking is active**, so the diagnostics trigger buttons appear only when they
would do something.

## Consumers

- [Forced update](ForcedUpdate.md) reads `minimumVersion`.
- [Kill switch](KillSwitch.md) reads `killSwitchActive`.

Both consume `values$` in the Business layer and expose their own derived
boolean; the UI never touches remote config directly.
