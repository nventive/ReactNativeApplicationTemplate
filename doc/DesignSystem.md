# Design system & theming

The app's visual language: design tokens (colors, spacing, radii,
typography), light/dark support, and a small set of themed base components every
screen builds from.

Everything lives under [`src/presentation/theme/`](../src/presentation/theme) and is
re-exported from its [`index.ts`](../src/presentation/theme/index.ts):

```ts
import { Screen, Card, AppText, Button, useTheme } from '../theme';
```

## Tokens

[`tokens.ts`](../src/presentation/theme/tokens.ts) is the single source of truth:

- **`ColorTokens`** — brand roles (`primary`/`onPrimary`,
  `secondary`/`onSecondary`, `error`/`onError`, `surface`/`onSurface`), plus the
  extra roles an RN surface needs (`background`, `onSurfaceMuted`, `border`,
  `favorite`). `lightColors` and `darkColors` carry the brand values for each
  scheme.
- **`spacing`** — a 4-pt scale (`xs`…`xxl`). Use it instead of literal
  margins/paddings.
- **`radius`** — corner radii (`sm`/`md`/`lg`).
- **`typography`** — text variants (`title`, `heading`, `body`, `subtitle`,
  `caption`, `button`) as size + weight; color is applied separately.

[`theme.ts`](../src/presentation/theme/theme.ts) bundles the tokens into a
`Theme` (`{ dark, colors, spacing, radius, typography }`) and exports
`lightTheme` / `darkTheme`.

## Provider, hooks, and the light/dark switch

[`ThemeProvider`](../src/presentation/theme/ThemeProvider.tsx) resolves the
active theme and exposes it via context. It wraps the app in
[`App.tsx`](../src/app/App.tsx).

- **`useTheme(): Theme`** — the active theme. It **falls back to `lightTheme`
  outside a provider** (so a component rendered in isolation in a test never
  crashes), unlike `useServices()` which throws.
- **`useThemeMode()`** — `{ mode, setMode }` where `mode` is
  `'system' | 'light' | 'dark'`. In `system` mode the OS color scheme wins and
  the app re-themes automatically when the device toggles dark mode; `setMode`
  forces a variant. The user-facing control is the **Theme** switch in the
  diagnostics overlay
  ([`ThemeSection`](../src/presentation/diagnostics/ThemeSection.tsx)), which
  applies immediately; the mechanism is here. For `system` mode to actually track
  the device, `app.config.ts` sets `userInterfaceStyle: 'automatic'` (pinning it
  to `light` would lock the native appearance and stop `useColorScheme()` from
  ever reporting dark).

React Navigation is themed too:
[`NavigationRoot`](../src/presentation/navigation/NavigationRoot.tsx) bridges the
tokens into a React Navigation `Theme`, so headers, tab bars, and the container
background follow the same palette.

## Base components

Small, themed primitives so screens hold **no inline color or magic number**:

| Component | Role |
|-----------|------|
| [`Screen`](../src/presentation/theme/Screen.tsx) | Root container — fills space, paints the themed background; `padded` / `center` props for the common layouts. |
| [`Card`](../src/presentation/theme/Card.tsx) | Elevated surface — rounded, bordered, padded from the theme. |
| [`AppText`](../src/presentation/theme/AppText.tsx) | Themed `Text` with a `variant` (typography) and `tone` (color role). |
| [`Button`](../src/presentation/theme/Button.tsx) | Primary action — `primary` (filled) / `outline` (bordered); always pass a localized `label`. |

## Convention

- Screens and components read visual values through **`useTheme()`** (or the base
  components) — never a hardcoded hex color, font size, or literal
  margin/padding. A color/spacing value that isn't in the tokens is a smell: add
  a token.
- New shared visual pieces become base components under `src/presentation/theme/`
  rather than one-off styles copied between screens.

See [Architecture.md](Architecture.md) for where the theme sits in the layers,
and [DadJokes.md](DadJokes.md) for the reference feature that renders with it.
