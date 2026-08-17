# App entry

`index.ts` registers the root component; `App.tsx` is the application shell
(providers + root navigator as they arrive in later phases).

Keep this layer minimal: it composes the Framework layer's providers around the
Presentation layer's root navigator — nothing else lives here.
