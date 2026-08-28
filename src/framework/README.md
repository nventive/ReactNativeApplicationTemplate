# Framework layer

The composition root and app-wide infrastructure: service wiring
(`composition/createServices.ts`, `ServicesProvider`), i18n, analytics and
logging setup.

## Rules

- **The only place the object graph is assembled.** `createServices.ts` builds
  every service with plain constructor calls — no DI container, no decorators.
  "Add a service" must stay a one-file, reviewable diff.
- **Construction stays pure; side effects live in `startServices.ts`.**
  `createServices` only builds objects — no launches, no I/O, no runtime attribute
  writes. The app entry calls `startServices(services)` once afterwards to run the
  one-time launch step (opt-in SDK launches, the crash-reporter environment
  attribute, the Firebase native/JS wiring guard). Prefer an explicit `start()`
  over constructor async when a service needs to kick off I/O.
- `ServicesProvider` (React Context) exposes the graph to Presentation;
  `useServices()` is the single doorway.
- May reference all layers (it wires them), but contains no feature logic of
  its own.
