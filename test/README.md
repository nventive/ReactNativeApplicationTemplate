# Tests

Headless tests, per the three-tier strategy:

- **Tier 1 — plain TS**: Jest in Node, zero React. Access/Business services,
  stores, RxJS streams. Fastest; prefer this tier whenever possible.
- **Tier 2 — React runtime, headless**: Jest + `@testing-library/react-native`
  (`renderHook`/RTL), no device. Hooks and components.

Co-located unit tests may also live next to sources as `*.test.ts(x)`; this
folder hosts the cross-layer/integration suites ("boot the graph, fake the
edges, drive through services") and shared test utilities.

Fake at the edges: **MSW** for network, jest mocks or Access-interface fakes
for native modules.

Tier 3 (thin device E2E) lives in [`e2e/`](../e2e/README.md).
