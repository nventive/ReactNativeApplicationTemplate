# The Dad Jokes sample feature

Dad Jokes is the template's **canonical vertical slice** — the reference every
new feature is cloned from, following the recipe in
[CLAUDE.md](../CLAUDE.md#adding-a-feature-the-canonical-recipe). It exercises
every pattern the architecture names: interface + real + mock at the Access
boundary, an RxJS source of truth in Business, and the two data paths (React
Query + `useObservable`) in Presentation.

## The slice, layer by layer

### Access — `src/access/jokes/`

| File | Role |
|------|------|
| [`Joke.ts`](../src/access/jokes/Joke.ts) | The flat DTO: `jokeSchema` (zod) + inferred `Joke` type, plus `favoriteJokesSchema` for the persisted list. |
| [`JokesResponse.ts`](../src/access/jokes/JokesResponse.ts) | The external Reddit envelope schema + `toJokes` mapper (`selftext` → `text`), collapsing the nested envelope into one flat DTO. |
| [`JokesRepository.ts`](../src/access/jokes/JokesRepository.ts) | The data contract (`getJokes()`); consumers depend on this only. |
| [`HttpJokesRepository.ts`](../src/access/jokes/HttpJokesRepository.ts) | Real impl: axios (the shared HTTP client) against `/r/dadjokes/top.json`, **zod-parsed at the boundary** (fail loud → `ParseError`). |
| [`MockJokesRepository.ts`](../src/access/jokes/MockJokesRepository.ts) | Fixture impl (ships with a couple of built-in fixtures) so the app runs offline. |

Transport/server/auth failures are already mapped to the
[typed taxonomy](../src/access/http/errors.ts) by the HTTP client's interceptor;
the repository only adds the parse case.

### Business — `src/business/jokes/`

[`JokesService`](../src/business/jokes/JokesService.ts) /
[`DefaultJokesService`](../src/business/jokes/DefaultJokesService.ts) — plain TS,
no React. It takes its Access deps by **constructor**
(`repository`, `KeyValueStore`, `Logger`, `AnalyticsSink`) and owns the two data
paths:

- **`fetchJokes()`** — a request/response fetch, consumed upstream via React Query.
- **`favorites$`** — a `BehaviorSubject<Joke[]>` **source of truth**, rehydrated
  from `KeyValueStore` on construction and re-persisted on every
  `toggleFavorite` (fail-soft read — see [Serialization.md](Serialization.md)).
  Because MMKV is synchronous, rehydration is inline in the constructor.

### Presentation — `src/presentation/jokes/`

- [`useJokes.ts`](../src/presentation/jokes/useJokes.ts) — a **thin** hook: React
  Query (keyed from the [`queryKeys`](../src/presentation/queryKeys.ts) factory)
  for the fetched list, `useObservable(favorites$)` for live favorites. No logic
  beyond binding.
- [`JokesScreen`](../src/presentation/jokes/JokesScreen.tsx) (list, wrapped in
  [`QueryStateView`](../src/presentation/components/QueryStateView.tsx) for
  loading/error), [`JokeDetailScreen`](../src/presentation/jokes/JokeDetailScreen.tsx)
  (pushed detail), [`FavoritesScreen`](../src/presentation/jokes/FavoritesScreen.tsx)
  (the Favorites tab), and [`JokeListItem`](../src/presentation/jokes/JokeListItem.tsx).
  Favoriting from **any** screen is instantly consistent everywhere because they
  all read the same `favorites$`. Every screen renders through the
  [design system](DesignSystem.md) and every string through `t()`.

### Wiring — one file

[`createServices.ts`](../src/framework/composition/createServices.ts) builds the
shared HTTP client, selects the repository (mock in development, real elsewhere —
the runtime mocking toggle can override this), and constructs
`DefaultJokesService`. Adding a feature is a one-file change here.

## How it's tested (all three tiers except device)

- **Tier 1** — [`MockJokesRepository.test.ts`](../test/access/jokes/MockJokesRepository.test.ts),
  [`HttpJokesRepository.test.ts`](../test/access/jokes/HttpJokesRepository.test.ts)
  (MSW: success / server / network / parse), and
  [`DefaultJokesService.test.ts`](../test/business/jokes/DefaultJokesService.test.ts)
  (toggle/emit/persist/rehydrate + fail-soft).
- **Tier 2** — [`useJokes.test.tsx`](../test/presentation/jokes/useJokes.test.tsx),
  [`favoriteFlow.test.tsx`](../test/presentation/jokes/favoriteFlow.test.tsx), and
  [`RootNavigator.test.tsx`](../test/presentation/navigation/RootNavigator.test.tsx).
- **Integration** — [`jokesSlice.integration.test.ts`](../test/integration/jokesSlice.integration.test.ts)
  drives the real graph with a faked edge.

See [Architecture.md](Architecture.md) for the layer rules this slice embodies.
