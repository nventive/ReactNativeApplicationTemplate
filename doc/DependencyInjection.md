# Dependency Injection

How services are wired together and reach the UI. The goals — layers wired
through interfaces, mocks swappable, everything headless-testable — are met with
**plain constructor injection and a composition root**. There is **no DI
container** and no service locator.

## The composition root

[`src/framework/composition/createServices.ts`](../src/framework/composition/createServices.ts)
is the **only** place the object graph is assembled. It builds every service
with plain constructor calls and returns a typed `Services` object that exposes
**interfaces only**:

```ts
export interface Services {
  readonly jokes: JokesService;
}

export function createServices(overrides: ServiceOverrides = {}): Services {
  // Access
  const jokesRepository = overrides.jokesRepository ?? new MockJokesRepository();
  // Business
  const jokes = overrides.jokes ?? new DefaultJokesService(jokesRepository);
  return { jokes };
}
```

> Reduced to one service for illustration. The real `createServices` wires the
> whole graph, selects the mock-vs-real implementation per Access source, and
> constructs `DefaultJokesService` with its full
> `(repository, store, logger, analytics)` dependencies.

Adding a service is a one-file, reviewable diff: construct its Access
dependencies, construct the service, add it to `Services` (and its seams to
`ServiceOverrides`).

The module is plain TypeScript with no React import, so the entire graph can be
booted in Node — that is what makes headless (Tier-1) testing of the wired
graph possible.

## Reaching services from the UI

[`ServicesProvider.tsx`](../src/framework/composition/ServicesProvider.tsx)
exposes the graph to Presentation through React Context. The app shell wraps
the tree once:

```tsx
const services = createServices();

<ServicesProvider services={services}>…</ServicesProvider>;
```

`useServices()` is the **single doorway** from Presentation to Business.
Screens and hooks never import service or repository implementations directly:

```ts
const { jokes } = useServices();
```

Calling `useServices()` outside the provider throws immediately with an
explanatory error — a missing provider is a wiring bug, not a state to handle.

## Swapping in fakes (tests and mocking)

`createServices` takes a partial-overrides parameter. Overriding a leaf (a
repository) rebuilds everything above it with the override in place;
overriding a service replaces that node wholesale:

```ts
// Tier 1 — drive the real graph headlessly with a faked edge:
const services = createServices({ jokesRepository: new FakeJokesRepository() });

// Tier 2 — the same graph handed to hooks under test:
<ServicesProvider services={services}>{children}</ServicesProvider>;
```

This is the same seam the runtime mocking toggle uses to select mock
repositories at graph construction.

## Why no container?

- **Nothing to resolve.** The graph is small, explicit, and readable by
  following constructor calls top to bottom. A locator would only obscure it.
- **Tests don't need one.** Swapping fakes is an ordinary function argument.
- **Toolchain friction.** Decorator/`reflect-metadata`-based containers fight
  the Babel/Metro pipeline RN builds through.

The approach is deliberate: interfaces, injection, mock swapping, and one startup
wiring point, with idiomatic mechanics.
