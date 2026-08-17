# Architecture

The layered architecture and how state flows through it in React Native terms.
The app follows MVVM principles, expressed idiomatically for React.

## Layers

| Layer | Folder | Contains | May depend on |
|-------|--------|----------|---------------|
| Access | `src/access/` | HTTP clients, storage, native wrappers, DTOs (zod-parsed) | nothing above it |
| Business | `src/business/` | Domain services & immutable entities (plain TS, RxJS) | Access interfaces |
| Presentation | `src/presentation/` | Screens, hooks, navigation, theme | Business interfaces via `useServices()` |
| Framework | `src/framework/` | Composition root, providers, i18n, logging setup | all (it wires them) |

Dependencies point strictly downward, and code is organized **by feature
within each layer** (`access/jokes/`, `business/jokes/`, `presentation/jokes/`).
Each layer's `README.md` states its rules; wiring is described in
[DependencyInjection.md](DependencyInjection.md).

## State management (MVVM)

Rather than ViewModel classes with observable properties, this template keeps the
**principle** — business state observable by the UI, logic testable without a
renderer — with two explicit data paths:

### 1. Fetched request/response data → React Query

Anything fetched on demand goes through `useQuery`, with the business service
as the query function. **Every query key comes from the central factory**
[`src/presentation/queryKeys.ts`](../src/presentation/queryKeys.ts) — never an
ad-hoc inline array:

```ts
const jokesQuery = useQuery({
  queryKey: queryKeys.jokes.list(),
  queryFn: () => jokes.fetchJokes(),
});
```

### 2. Live domain state → RxJS + `useObservable`

State that many screens react to lives in the Business layer as a
**`BehaviorSubject` source of truth**, exposed as an `Observable`:

```ts
// business — plain TS, no React
private readonly _favorites$ = new BehaviorSubject<Joke[]>([]);
readonly favorites$ = this._favorites$.asObservable();
```

The UI subscribes through the single bridge
[`src/presentation/hooks/useObservable.ts`](../src/presentation/hooks/useObservable.ts):

```ts
const favorites = useObservable(jokes.favorites$, []);
```

**Conventions** (guardrails):

- Business state is a `BehaviorSubject` + this bridge. **No clever RxJS
  operator pipelines** — if a stream needs transformation, that logic belongs
  in the Business service, not in the UI or the subscription.
- Services emit **immutable snapshots** (a new array/object per emission).
- Hooks stay **thin bindings**: `useJokes` binds service calls to React Query
  and observables to `useObservable`, nothing more. Heavy logic lives in
  plain-TS Access/Business units.
- UI-local state escalates deliberately: React hooks → Zustand (shared UI
  state) → MobX observable maps (hot derived collections only).

## The reference slice — Dad Jokes

`src/{access,business,presentation}/jokes/` is the canonical vertical slice, and
the **copy-me example** every new feature is cloned from following the recipe in
[CLAUDE.md](../CLAUDE.md). It is complete: real HTTP (zod-parsed) + mock
repositories, favorites as a persisted `BehaviorSubject` source of truth,
list/detail navigation, and the [design system](DesignSystem.md). Read
[DadJokes.md](DadJokes.md) for the full file-by-file walkthrough before starting
a new feature.
