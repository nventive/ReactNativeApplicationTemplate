# Navigation

The navigation shell — **React Navigation** with bottom tabs, per-tab native
stacks, and two modals — a two-branch bottom navigation.

## Structure

```
RootStack (native-stack)                 src/presentation/navigation/RootNavigator.tsx
├─ Tabs (bottom-tabs)                     AppTabs.tsx
│  ├─ JokesTab → JokesStack               JokesStack.tsx  (JokesList → JokeDetail)
│  └─ FavoritesTab → FavoritesStack       FavoritesStack.tsx (FavoritesList)
└─ Modals (presentation: 'modal' group)
   ├─ ExampleModal                        ExampleModalScreen.tsx
   └─ Feedback                            FeedbackFormScreen.tsx
```

Each tab hosts its **own** native stack, so a pushed detail keeps the tab bar
visible. The pushed `JokeDetail` and `ExampleModal` are demonstration screens;
the full Dad Jokes detail screen is added later.

The forced-update and kill-switch blocking screens are **not** routes: they
block the whole app from *outside* the navigator via `AppGate` (see
[ForcedUpdate.md](ForcedUpdate.md)), so they fully replace the shell and lift
automatically when the remote flag clears.

## Typed routes (guardrail)

All param lists live in
[`types.ts`](../src/presentation/navigation/types.ts); a global
`ReactNavigation.RootParamList` augmentation makes `useNavigation`, `useRoute`,
and the imperative ref typed everywhere. **Wrong route names or params are type
errors, and there are no string-literal routes outside these types.**

```ts
navigation.navigate('JokeDetail', { jokeId: joke.id }); // typed
route.params.jokeId;                                     // typed
```

## Adding a tab or screen

1. Add the route to the relevant param list in `types.ts`.
2. Add a `<Stack.Screen>` / `<Tabs.Screen>` with a `t(...)` title.
3. Navigate with the typed `useNavigation()`.

## Imperative navigation

[`navigationRef`](../src/presentation/navigation/navigationRef.ts) lets non-React
code navigate without a `navigation` prop
— the seam for a future service that needs to redirect imperatively.
[`NavigationRoot`](../src/presentation/navigation/NavigationRoot.tsx) wires it plus
an `onReady`/`onStateChange` observer that logs the route and reports the screen
view to analytics. Note the operational blocks
(forced update / kill switch) do **not** use this — they gate outside the
navigator via `AppGate`.

## Android back

- Hardware back pops the current native stack (detail → list → parent), dismisses
  a modal, and exits at the root — handled automatically by native-stack.
- Bottom tabs use `backBehavior="history"` (back walks previously-visited tabs).

Genuine hardware-back semantics, native transition/gesture animations, and
safe-area insets on notched devices are **device-only** behavior covered by the
Maestro smoke flows, not unit tests.

## Testing

`NavigationContainer` runs headless under RNTL (with a safe-area mock in
`jest.setup.js`).
[`RootNavigator.test.tsx`](../test/presentation/navigation/RootNavigator.test.tsx)
covers the initial screen, tab switching, a pushed detail (typed params), the
modal, and cross-tab favorites consistency through the observable.
