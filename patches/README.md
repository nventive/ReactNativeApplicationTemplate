# Dependency patches

Patches in this folder are applied to `node_modules` by
[`patch-package`](https://github.com/ds300/patch-package) on every install (the
`postinstall` script in `package.json`). They exist only to carry an
already-fixed-upstream change until it reaches a published release; each one is
**temporary** and should be deleted the moment the dependency ships the fix.

Keep this list current — a stale patch that no longer applies fails the install
loudly (by design), which is the signal to remove it.

## `expo-modules-jsi+57.0.4.patch`

- **What:** qualifies `abs(...)` as `Swift.abs(...)` in
  `apple/Sources/ExpoModulesJSI/Coding/JavaScriptCodable+Date.swift`.
- **Why:** with C++ interop enabled (which Expo's JSI modules turn on), Xcode
  **26.2**'s Swift 6.2 compiler cannot disambiguate the bare `abs` between Swift's
  and the C/C++ stdlib overload, so the signed iOS archive fails to compile with
  *"type of expression is ambiguous without a type annotation."* This is the exact
  upstream fix — see [expo/expo#48261](https://github.com/expo/expo/pull/48261)
  (issue [#47957](https://github.com/expo/expo/issues/47957)).
- **Why we carry it:** `57.0.4` is the newest published `expo-modules-jsi`, and the
  fix has not yet landed in a stable SDK 57 patch. We can't downgrade off Swift 6.2
  (the package *requires* it — that's what pins us to Xcode 26), and every Swift 6.2
  toolchain hits this. See [doc/AzurePipelines.md](../doc/AzurePipelines.md)
  ("Toolchain is pinned").
- **Remove when:** `expo-modules-jsi > 57.0.4` (a `57.0.x` with the fix) is released
  and adopted — bump the dep, delete this patch, confirm the iOS archive still
  compiles on Xcode 26.
