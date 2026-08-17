# Presentation layer

Screens, hooks, navigation, and theming — everything React.

## Rules

- **Talks to Business through interfaces only**, obtained via `useServices()`
  (the composition-root Context). **Never imports Access implementations
  directly.**
- Each feature gets a **thin hook** (e.g. `useJokes`) binding services to React:
  **React Query** for fetched request/response data, **`useObservable`** for
  live business state. Heavy logic belongs in Business/Access, not in hooks.
- Local/shared UI state escalates deliberately: hooks → Zustand → MobX
  observable maps (only for hot derived collections).
- Code is organized **by feature** (`presentation/jokes/`,
  `presentation/diagnostics/`, …) plus shared folders (`navigation/`, `theme/`,
  `hooks/`).
