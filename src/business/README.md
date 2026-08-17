# Business layer

Domain services and immutable entities that manipulate data from the Access
layer.

## Rules

- **May depend on Access only** (through its interfaces, injected via the
  constructor). No imports from `presentation/`, `framework/`, or `app/`.
  **No React** — everything here is plain TypeScript, fully headless-testable.
- Services are declared as **interfaces** with a default implementation
  (e.g. `JokesService` / `DefaultJokesService`).
- Live state a screen must react to is exposed as an **RxJS `Observable`**
  backed by a `BehaviorSubject` source of truth (no clever operator pipelines).
- Code is organized **by feature** (`business/jokes/`, `business/environment/`, …).
