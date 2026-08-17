# E2E (Tier 3 — thin device tests)

**Maestro** smoke flows only — the native rendering/gesture risks that only a
device can catch (launch, navigate, favorite a joke). Everything else is
covered headless in [`test/`](../test/README.md) and co-located unit tests
(see [doc/Testing.md](../doc/Testing.md)).

Human-triggered during development; wired into CI as a device-test stage
([doc/AzurePipelines.md](../doc/AzurePipelines.md)).

## Flows

| Flow | What it proves |
|------|----------------|
| [`flows/launch.yaml`](flows/launch.yaml) | The app boots and paints the Dad Jokes list through all layers. |
| [`flows/favorite-joke.yaml`](flows/favorite-joke.yaml) | Favoriting a joke shows it on the Favorites tab (cross-screen `favorites$`). |
| [`flows/navigate.yaml`](flows/navigate.yaml) | Push/pop a detail screen and present/dismiss the example modal. |

All flows are tagged `smoke`. [`config.yaml`](config.yaml) makes the folder a
Maestro workspace.

## Prerequisites

1. Install Maestro: `curl -Ls "https://get.maestro.mobile.dev" | bash`
   (see the [Maestro docs](https://maestro.mobile.dev/)).
2. Build and install a **debug** build on a booted emulator/simulator — Maestro
   drives an already-installed app, it does not build one. Follow
   [doc/GettingStarted.md](../doc/GettingStarted.md):
   - Android: `npx expo run:android` (or `expo prebuild` + `./gradlew installDebug`).
   - iOS: `npx expo run:ios`.

## Run

From the repo root:

```bash
maestro test e2e/                       # every flow
maestro test --include-tags smoke e2e/  # only smoke-tagged (what CI runs)
maestro test e2e/flows/favorite-joke.yaml   # a single flow
```

## Conventions

- **Selectors are `testID`s** — never localized copy, so the flows survive
  translation. The screens expose:
  `DadJokesContainer`, `JokeListItem-<id>`, `JokeDetailButton-<id>`,
  `JokeDetail`, `ToggleFavoriteButton`, `OpenModalButton`, `ExampleModal`,
  `FavoritesContainer`, `FavoritesEmpty`, and the tab buttons `JokesTab` /
  `FavoritesTab` (`tabBarButtonTestID`). Add a `testID` to a component before
  referencing it from a flow.
- **`appId`** in each flow tracks `app.config.ts`
  (`ios.bundleIdentifier` / `android.package`); the project generator
  rewrites it on rename.
- Keep flows **thin** — smoke coverage only. Business logic and state belong in
  Tier 1/2 headless tests, which are far faster and run on every change.
