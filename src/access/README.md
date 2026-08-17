# Access layer (DAL)

API clients, local storage, native-module wrappers, remote config, and the
serializable data-transfer objects (DTOs) they exchange.

## Rules

- **Depends on nothing above it.** No imports from `business/`, `presentation/`,
  `framework/`, or `app/`. No React.
- Every dependency on the outside world (network, storage, native module) is
  declared as an **interface** with a **real** and a **mock** implementation
  (e.g. `JokesRepository` / `HttpJokesRepository` / `MockJokesRepository`).
- External data is parsed and validated with a **zod** schema at the boundary;
  the DTO type is inferred from the schema.
- Code is organized **by feature** (`access/jokes/`, `access/storage/`, …).
