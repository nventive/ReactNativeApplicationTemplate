# Project Generator

The template ships a small **project generator** — a TypeScript/Node CLI that
turns a fresh checkout into your own renamed application. It substitutes the app
name, slug, and bundle identifier / Android package throughout the project,
rewrites the README, and removes the template-only scaffolding so what remains is
a clean starting point.

Because the project uses **Expo with Continuous Native Generation**, the app's
identity lives in [app.config.ts](../app.config.ts) (name, slug, iOS bundle
identifier, Android package). `expo prebuild` regenerates the native `android/`
and `ios/` projects from it, so renaming is a source-file operation — there are
no committed native projects to rewrite.

## 1. Get the template

The generator renames a checkout in place, so first get one. Any of:

```sh
npx degit nventive/ReactNativeApplicationTemplate my-app
# or: npx create-expo-app my-app --template <tarball-url>
# or: GitHub → "Use this template"
```

Then install dependencies (the generator uses the project's own Prettier to
format what it changes):

```sh
cd my-app
yarn install
```

## 2. Run the generator

```sh
yarn generate --name "Acme App" --bundle-id com.acme.acmeapp
```

| Flag | Required | Meaning |
|------|:--------:|---------|
| `--name` | yes | Display name (Expo `name`), e.g. `"Acme App"`. |
| `--bundle-id` | yes | Production application id / Android package, e.g. `com.acme.acmeapp`. |
| `--slug` | no | npm package name + Expo slug. Defaults to a slug derived from `--name` (`acme-app`). |
| `--dir` | no | Project root to transform. Defaults to the current directory. |
| `--keep-template-files` | no | Keep the governance/template files and the generator itself. |
| `--dry-run` | no | Print the plan without changing anything. |
| `-h`, `--help` | no | Show usage. |

Preview first if you like:

```sh
yarn generate --name "Acme App" --bundle-id com.acme.acmeapp --dry-run
```

### Two bundle-id lanes

You pass your **production** application id. The template builds on two lanes —
production and an internal (dev/staging) lane — so the generator also derives an
internal variant by inserting an `internal` segment before the last:

```
--bundle-id com.acme.acmeapp
  → production : com.acme.acmeapp
  → internal   : com.acme.internal.acmeapp   (used by app.config.ts and dev/staging builds)
```

Both are substituted wherever they appear (app config, environment store URLs,
Maestro `appId`s, the CI signing conventions, and the Firebase example configs).

## 3. What it changes

- **Identity substitution** across every text file: the display name, slug, and
  both bundle-id lanes.
- **README.md** is replaced with a short starter README for your app.
- **Removed** (unless `--keep-template-files`): `.github/`, `.mergify.yml`,
  `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `LICENSE`, `BREAKING_CHANGES.md`,
  `build/templates/template-validation.yml` (the CI steps that validate *this*
  generator — see
  [AzurePipelines.md](AzurePipelines.md#template-validation-stage)), and the
  generator itself (`cli/`, plus its `doc/` page). The generator also strips its
  own wiring — the `generate` script, the cli typecheck step, and the cli Jest
  root — so the project's quality gates keep working once `cli/` is gone.
- **Scrubbed in place**: the `Template_Validation` stage in
  `build/azure-pipelines.yml` and its section in `doc/AzurePipelines.md` (both
  bracketed by `template-only` markers) are removed from those files, leaving the
  rest of the pipeline and doc intact.
- **Formatting**: files it edited are re-run through Prettier, because shortening
  or lengthening an identifier can change how a line wraps.

It does **not** touch `android/`, `ios/`, `node_modules/`, `.git/`, or the
generator's own sources (they hold the template identifiers as data).

## 4. After generating

```sh
yarn typecheck && yarn lint && yarn test   # type-check, lint, run tests
yarn android   # or: yarn ios              # first native build (regenerates android/ or ios/)
```

See [GettingStarted.md](GettingStarted.md) for build prerequisites.

## How it works

The CLI is plain TypeScript run with Node's native TypeScript support
(`node cli/index.ts`, Node 22.6+); there is no build step. The logic is a set of
pure functions in `cli/generate.ts`:

- `resolveIdentifiers` validates the flags and derives the slug and internal
  bundle id.
- `collectTextFiles` walks the tree (skipping excluded and binary files) and
  `applyReplacements` performs the substitution — longest identifier first, so a
  shorter one can never partially match a longer one.
- `stripTemplateOnlyBlocks` removes each `template-only:begin`…`template-only:end`
  region from the pipeline and its doc (the `Template_Validation` stage), so
  files that must survive generation keep everything *except* the marked block.
- `generate` orchestrates substitution, README rewrite, cleanup, un-wiring, and
  the block strip; `formatFiles` runs the Prettier pass.

Tests live in `cli/generate.test.ts` and run in the normal `yarn test` suite.
