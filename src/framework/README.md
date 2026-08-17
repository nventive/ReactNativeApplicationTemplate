# Framework layer

The composition root and app-wide infrastructure: service wiring
(`composition/createServices.ts`, `ServicesProvider`), i18n, analytics and
logging setup.

## Rules

- **The only place the object graph is assembled.** `createServices.ts` builds
  every service with plain constructor calls — no DI container, no decorators.
  "Add a service" must stay a one-file, reviewable diff.
- `ServicesProvider` (React Context) exposes the graph to Presentation;
  `useServices()` is the single doorway.
- May reference all layers (it wires them), but contains no feature logic of
  its own.
