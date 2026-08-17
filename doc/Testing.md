# Testing

The headless-first, three-tier testing strategy for this template.

The guiding rule: **prefer the lowest tier that can catch the bug.** Almost all
logic lives in plain-TS Access/Business units and is covered at Tier 1; the UI
binding is covered headless at Tier 2; only genuine native rendering/gesture
risks reach a device at Tier 3.

## Tiers

| Tier | Runs | Use for |
|------|------|---------|
| **1 — Plain TS** | Jest in Node, zero React | Access + Business services, RxJS streams, the composition root |
| **2 — React runtime, headless** | Jest + `@testing-library/react-native` (`render`/`renderHook`), no device | Hooks and components (store → view binding) |
| **3 — Device E2E (thin)** | Maestro on an emulator/simulator | Native rendering/gesture risks only a device can catch |

Tier 1 and Tier 2 run as part of `yarn typecheck && yarn lint && yarn test` and
gate every change. Tier 3 is human-triggered locally and runs as a device stage
in CI.

Suites live in `test/` (which follows the `src/` layout, with runnable examples
under `test/examples/`) or co-located as `*.test.ts(x)`. Maestro flows live in
[`e2e/`](../e2e/README.md).

## Fake at the edges

No test talks to a real backend or a real native module.

- **Network** — MSW (`msw/node`); see `test/examples/tier1-msw.test.ts` and
  `test/examples/tier2-react-query-msw.test.tsx`.
- **Access interfaces** — a hand-written fake or the feature's
  `Mock*Repository`, injected through `createServices({ ...overrides })` or a
  direct constructor call.
- **Native modules** — jest mocks or Access-interface fakes (the interface is
  the seam; `jest-expo` mocks the Expo/RN internals). Two custom mocks fill
  gaps the preset does not: `react-native-mmkv` → an in-memory store
  (`test/mocks/reactNativeMmkv.ts`, wired via `moduleNameMapper`), and
  `react-native-safe-area-context` → a synchronous passthrough
  (`jest.setup.js`).

## Tier 1 — plain TS

The fastest tier: construct the unit directly, drive it, assert. Business
services and Access repositories carry the logic, so this is where most
coverage lives.

```ts
// test/business/jokes/DefaultJokesService.test.ts (shape)
const service = new DefaultJokesService(new MockJokesRepository(), store, logger, analytics);

const emitted: Joke[][] = [];
const sub = service.favorites$.subscribe((f) => emitted.push(f));
service.toggleFavorite(joke);        // mutate + emit + persist

expect(emitted.at(-1)).toEqual([joke]);
sub.unsubscribe();
```

RxJS state is asserted by collecting emissions from the service's `Observable`s
(subscribe, act, assert the recorded array). MSW covers any repository that
crosses the network (`test/access/http/httpClient.test.ts` proves the whole
interceptor chain — success, error mapping, and single-flight 401 refresh).

## Tier 2 — React runtime, headless

Renders the hook/component to a JS object tree — no device. Wrap the same graph
the app uses in the providers, built with fakes:

```tsx
// The provider wrapper every Tier-2 test uses.
const services = createServices({ jokesRepository: new MockJokesRepository() });
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity } },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <ServicesProvider services={services}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </ServicesProvider>
);

const { result } = await renderHook(() => useJokes(), { wrapper });
```

- `render` / `renderHook` are **async** in RNTL v14 — `await` them.
- A press that flips an observable must be flushed inside `act`:
  `await act(async () => { fireEvent.press(node); });` — otherwise the
  `useObservable` re-render is dropped and the assertion sees stale UI.

## The headless integration pattern

These tests boot the real composition root with mocks forced, in plain Node —
no device, no UI. This is the strongest "does the wiring hold together" test we
have that still runs with the standard checks.

1. **Boot the real graph** with only the edges faked:
   `createServices({ jokesRepository: fake })`.
2. **Drive scenarios through the public service interfaces.**
3. **Assert on returned data and on observable state** (collect emissions from
   the services' `Observable`s).

Reference suites:

- `test/integration/jokesSlice.integration.test.ts` — the sample feature:
  fetch jokes, toggle favorites, assert the `favorites$` stream.
- `test/integration/operational.integration.test.ts` — the operational flows:
  **forced update** and **kill switch** driven through the mock remote-config
  edge, plus the two **restart-to-apply switches** (environment and mocking
  toggle), which are proven by building a second graph over a **shared
  `KeyValueStore`** — the "restart" a runtime switch needs to take effect:

  ```ts
  const store = new InMemoryKeyValueStore();
  const first = createServices({ keyValueStore: store, mockingEnabled: true });
  await first.environment.setEnvironment('staging');   // persists, not applied live
  expect(first.environment.getCurrent()).not.toBe('staging');

  const relaunched = createServices({ keyValueStore: store, mockingEnabled: true });
  expect(relaunched.environment.getCurrent()).toBe('staging'); // applied on restart
  ```

## Tier 3 — device E2E (Maestro)

Thin smoke flows only, in [`e2e/`](../e2e/README.md): launch, navigate, favorite
a joke. They catch the native rendering/gesture/back-button risks that a JS
object tree cannot, so they are **human-triggered** and verified on a real
toolchain.

```yaml
# e2e/flows/favorite-joke.yaml (excerpt)
appId: com.nventive.internal.reactnativeapptemplate
tags: [smoke]
---
- launchApp: { clearState: true }
- assertVisible: { id: 'DadJokesContainer' }
- tapOn: { id: 'JokeListItem-.*', index: 0 }   # favorite the first joke
- tapOn: { id: 'FavoritesTab' }
- assertVisible: { id: 'FavoritesContainer' }
```

Run against a booted emulator/simulator with a debug build installed:

```bash
maestro test e2e/                        # every flow
maestro test --include-tags smoke e2e/   # only smoke-tagged (what CI runs)
```

Selectors are **`testID`s**, never localized copy, so flows survive
translation. See
[`e2e/README.md`](../e2e/README.md) for prerequisites, the full selector list,
and CI wiring.

## Coverage

`yarn test:coverage` runs the whole Tier-1/2 suite under Jest's coverage
collector; the text summary prints and an HTML/lcov report is written to
`coverage/`. Coverage is a
diagnostic for finding untested logic, **not** a gate — no threshold blocks the
build. Native adapters (`Mmkv*`, `Expo*`, `Linking*`) sit behind interfaces and
are intentionally covered at Tier 3, not here.

In CI the `Verify` stage runs the same suite with `--coverage` and publishes two
machine-readable reports on every build (`build/templates/verify.yml`): **JUnit**
test results (via the `jest-junit` reporter → the pipeline's Tests tab) and
**Cobertura** coverage (`coverage/cobertura-coverage.xml` → the Code Coverage
tab). Both are informational — still no threshold gate.

## Conventions

- Test names describe the expected behavior (`'toggleFavorite adds then
  removes, emitting on every change'`).
- Tier-2 React Query clients disable retries and gc timers:
  `new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })`.
- Prefer the lowest tier that can catch the bug — Tier 1 over Tier 2, Tier 2
  over a device.
- Subscribe/act/assert then **unsubscribe** in Tier-1 observable tests; leaked
  subscriptions and live timers surface as Jest's "worker failed to exit
  gracefully" warning.
