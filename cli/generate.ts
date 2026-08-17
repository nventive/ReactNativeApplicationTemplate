/**
 * Project generator — turns a fresh checkout of this template into a renamed,
 * ready-to-build application.
 *
 * With Continuous Native Generation the app identity lives in `app.config.ts`
 * (name, slug, iOS bundle identifier, Android package); `expo prebuild`
 * regenerates the native projects from it, so renaming is a source-file
 * substitution rather than native-folder surgery. This module owns that
 * substitution: it replaces the template identifiers throughout the tree,
 * removes the governance/template-only files a brand-new project does not want,
 * and writes a starter README.
 *
 * The runnable entry point is `index.ts`; everything here is a pure, testable
 * function so the behaviour can be exercised without spawning a process.
 */
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

/** The identifiers that describe an application's identity. */
export interface Identifiers {
  /** Human-facing display name, e.g. `Acme App` (Expo `name`). */
  readonly appName: string;
  /** npm package name + Expo slug, e.g. `acme-app`. */
  readonly slug: string;
  /** Production application id / Android package, e.g. `com.acme.acmeapp`. */
  readonly baseBundleId: string;
  /** Dev/staging variant with an `internal` segment, e.g. `com.acme.internal.acmeapp`. */
  readonly internalBundleId: string;
}

/**
 * The identity this template ships with — the "from" side of every
 * substitution. Any occurrence of these strings in a text file is rewritten to
 * the caller's chosen values.
 */
export const TEMPLATE_IDENTIFIERS: Identifiers = {
  appName: 'React Native App Template',
  slug: 'react-native-application-template',
  baseBundleId: 'com.nventive.reactnativeapptemplate',
  internalBundleId: 'com.nventive.internal.reactnativeapptemplate',
};

/**
 * Governance and template-scaffolding paths (relative to the project root) that
 * a generated application does not carry. Directories are removed recursively.
 * The generator's own folder (`cli`) is included so it does not ship inside the
 * new project, and `build/templates/template-validation.yml` — the CI steps that
 * exercise this generator — goes with it (its `Template_Validation` stage in
 * `build/azure-pipelines.yml` is stripped separately by
 * `stripTemplateOnlyBlocks`, so nothing is left referencing it).
 */
export const TEMPLATE_ONLY_PATHS: readonly string[] = [
  '.github',
  '.mergify.yml',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'BREAKING_CHANGES.md',
  'doc/ProjectGenerator.md',
  'build/templates/template-validation.yml',
  'cli',
];

/** Directory names never descended into when scanning for text to rewrite. */
const EXCLUDED_DIRECTORIES: ReadonlySet<string> = new Set([
  '.git',
  'node_modules',
  'android',
  'ios',
  '.expo',
  'coverage',
  'dist',
  '.vscode',
  // The generator's own sources hold the template identifiers as data; rewriting
  // them would corrupt the tool. It is removed wholesale by the cleanup step.
  'cli',
  // Template-development scaffolding — not part of a generated app and
  // pointless to rewrite.
  'migration',
]);

/** File extensions treated as substitutable text. Everything else is left as-is. */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.plist',
  '.xml',
  '.txt',
  '.html',
  '.example',
]);

/** Minimal logger seam so tests can capture output instead of hitting stdout. */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const consoleLogger: Logger = {
  info: (m) => console.log(m),
  warn: (m) => console.warn(m),
  error: (m) => console.error(m),
};

/** Raw command-line arguments after parsing, before validation. */
export interface ParsedArgs {
  name?: string;
  bundleId?: string;
  slug?: string;
  dir?: string;
  dryRun: boolean;
  keepTemplateFiles: boolean;
  help: boolean;
}

const BOOLEAN_FLAGS: Record<string, keyof ParsedArgs> = {
  '--dry-run': 'dryRun',
  '--keep-template-files': 'keepTemplateFiles',
  '--help': 'help',
  '-h': 'help',
};

const VALUE_FLAGS: Record<string, keyof ParsedArgs> = {
  '--name': 'name',
  '--bundle-id': 'bundleId',
  '--slug': 'slug',
  '--dir': 'dir',
};

/**
 * Parses `--flag value`, `--flag=value`, and boolean flags. Throws on unknown
 * flags or a value flag with no value, so mistakes surface instead of being
 * silently dropped.
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const parsed: ParsedArgs = { dryRun: false, keepTemplateFiles: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const eq = token.indexOf('=');
    const flag = eq === -1 ? token : token.slice(0, eq);

    if (flag in BOOLEAN_FLAGS) {
      (parsed[BOOLEAN_FLAGS[flag]] as boolean) = true;
      continue;
    }

    if (flag in VALUE_FLAGS) {
      let value: string | undefined;
      if (eq !== -1) {
        value = token.slice(eq + 1);
      } else {
        value = argv[++i];
      }
      if (value === undefined) {
        throw new Error(`Missing value for ${flag}.`);
      }
      (parsed[VALUE_FLAGS[flag]] as string) = value;
      continue;
    }

    throw new Error(`Unknown argument: ${token}.`);
  }

  return parsed;
}

/** Turns a display name into a url-safe slug: `Acme App!` -> `acme-app`. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const BUNDLE_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Derives the dev/staging bundle id from the production one by inserting an
 * `internal` segment before the last: `com.acme.acmeapp` ->
 * `com.acme.internal.acmeapp`. The two ids feed the template's two build lanes.
 */
export function deriveInternalBundleId(baseBundleId: string): string {
  const segments = baseBundleId.split('.');
  segments.splice(segments.length - 1, 0, 'internal');
  return segments.join('.');
}

export type Resolution =
  | { readonly ok: true; readonly identifiers: Identifiers }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Validates the parsed arguments and resolves the full identifier set, deriving
 * the slug from the name and the internal bundle id from the production one when
 * not given explicitly.
 */
export function resolveIdentifiers(args: ParsedArgs): Resolution {
  const errors: string[] = [];

  const appName = args.name?.trim();
  if (!appName) {
    errors.push('--name is required (the app display name, e.g. "Acme App").');
  }

  const baseBundleId = args.bundleId?.trim();
  if (!baseBundleId) {
    errors.push('--bundle-id is required (e.g. com.acme.acmeapp).');
  } else if (!BUNDLE_ID_PATTERN.test(baseBundleId)) {
    errors.push(
      `--bundle-id "${baseBundleId}" is invalid: use at least two lowercase ` +
        'reverse-DNS segments, letters/digits/underscore only (e.g. com.acme.acmeapp).',
    );
  }

  const slug = args.slug?.trim() ? args.slug.trim() : appName ? slugify(appName) : '';
  if (appName && !slug) {
    errors.push(`Could not derive a slug from --name "${appName}"; pass --slug explicitly.`);
  } else if (slug && !SLUG_PATTERN.test(slug)) {
    errors.push(
      `--slug "${slug}" is invalid: lowercase letters, digits and hyphens only, ` +
        'starting with a letter or digit (e.g. acme-app).',
    );
  }

  if (errors.length > 0 || !appName || !baseBundleId) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    identifiers: {
      appName,
      slug,
      baseBundleId,
      internalBundleId: deriveInternalBundleId(baseBundleId),
    },
  };
}

/** A single search-and-replace rule. */
export interface Replacement {
  readonly from: string;
  readonly to: string;
}

/**
 * Builds the substitution rules, longest `from` first so a shorter identifier
 * can never partially consume a longer one.
 */
export function buildReplacements(identifiers: Identifiers): Replacement[] {
  return [
    { from: TEMPLATE_IDENTIFIERS.internalBundleId, to: identifiers.internalBundleId },
    { from: TEMPLATE_IDENTIFIERS.baseBundleId, to: identifiers.baseBundleId },
    { from: TEMPLATE_IDENTIFIERS.slug, to: identifiers.slug },
    { from: TEMPLATE_IDENTIFIERS.appName, to: identifiers.appName },
  ].sort((a, b) => b.from.length - a.from.length);
}

/** Applies replacements to a string, returning the result and a match count. */
export function applyReplacements(
  content: string,
  replacements: readonly Replacement[],
): { readonly content: string; readonly count: number } {
  let result = content;
  let count = 0;
  for (const { from, to } of replacements) {
    const parts = result.split(from);
    if (parts.length > 1) {
      count += parts.length - 1;
      result = parts.join(to);
    }
  }
  return { content: result, count };
}

/**
 * Walks the tree under `root`, returning the absolute paths of every text file
 * eligible for substitution (excluded directories skipped, binary extensions
 * ignored).
 */
export function collectTextFiles(root: string): string[] {
  const files: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
          walk(join(dir, entry.name));
        }
      } else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        files.push(join(dir, entry.name));
      }
    }
  };

  walk(root);
  return files;
}

/** A short, self-contained README for the generated application. */
export function renderAppReadme(identifiers: Identifiers): string {
  return `# ${identifiers.appName}

A mobile application built with React Native and Expo.

## Getting started

\`\`\`bash
yarn install          # install dependencies
yarn start            # start the Metro dev server
yarn android          # build & run on Android
yarn ios              # build & run on iOS
\`\`\`

## Quality gates

\`\`\`bash
yarn typecheck        # TypeScript, no emit
yarn lint             # ESLint + Prettier
yarn test             # Jest unit & component tests
\`\`\`

## Configuration

App identity (name, slug, bundle identifier, Android package) lives in
[app.config.ts](app.config.ts). The native \`android/\` and \`ios/\` projects are
generated from it by \`expo prebuild\` and are not committed.
`;
}

/**
 * Removes the generator's own tooling wiring from the project so its quality
 * gates keep working once the `cli` folder is gone: the `generate` script, the
 * cli typecheck step, and the cli Jest root. Returns the files it changed.
 * Idempotent — safe to run when the wiring is already absent.
 */
export function unwireGeneratorTooling(root: string): string[] {
  const changed: string[] = [];

  const packageJsonPath = join(root, 'package.json');
  if (existsSync(packageJsonPath)) {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    let touched = false;
    if (typeof scripts.generate === 'string') {
      delete scripts.generate;
      touched = true;
    }
    if (typeof scripts.typecheck === 'string' && scripts.typecheck.includes('cli/tsconfig.json')) {
      scripts.typecheck = scripts.typecheck.replace(
        /\s*&&\s*tsc --noEmit -p cli\/tsconfig\.json/,
        '',
      );
      touched = true;
    }
    if (touched) {
      writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
      changed.push('package.json');
    }
  }

  const jestConfigPath = join(root, 'jest.config.js');
  if (existsSync(jestConfigPath)) {
    const original = readFileSync(jestConfigPath, 'utf8');
    const updated = original.replace(/,\s*'<rootDir>\/cli'/, '');
    if (updated !== original) {
      writeFileSync(jestConfigPath, updated);
      changed.push('jest.config.js');
    }
  }

  return changed;
}

/**
 * Marker tokens that bracket a "template-only" region — a block that belongs in
 * the template repository but not in a generated app (e.g. the CI stage that
 * validates this generator). The comment syntax around them is irrelevant
 * (`# ...` in YAML, `<!-- ... -->` in Markdown); only these substrings matter.
 */
export const TEMPLATE_ONLY_BEGIN = 'template-only:begin';
export const TEMPLATE_ONLY_END = 'template-only:end';

/**
 * A marker is recognised only as a *comment-prefixed* line — `# …` (YAML) or
 * `<!-- … -->` (Markdown) — so prose that merely mentions the token (e.g. a doc
 * paragraph explaining the mechanism) is never mistaken for a marker and cannot
 * terminate a block early. Leading whitespace is allowed (markers are indented
 * to their surrounding block).
 */
const BEGIN_MARKER = new RegExp(`^\\s*(?:#|<!--)\\s*${TEMPLATE_ONLY_BEGIN}\\b`);
const END_MARKER = new RegExp(`^\\s*(?:#|<!--)\\s*${TEMPLATE_ONLY_END}\\b`);

/**
 * Removes every line from a `template-only:begin` marker through the next
 * `template-only:end` marker (both inclusive), then collapses any blank run the
 * removal opened up to a single blank line. Idempotent — a file with no markers
 * comes back unchanged. Files this template ships are known to balance their
 * markers; an unterminated block would drop to end-of-file.
 */
export function stripTemplateOnlyBlocks(content: string): string {
  const kept: string[] = [];
  let inside = false;
  for (const line of content.split('\n')) {
    if (!inside && BEGIN_MARKER.test(line)) {
      inside = true;
      continue;
    }
    if (inside) {
      if (END_MARKER.test(line)) {
        inside = false;
      }
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Files (relative to the project root) that carry `template-only` regions the
 * generated app must not keep: the CI stage that runs this generator and its
 * documentation. Deleting the generator's `cli` folder handles the code; these
 * files instead have a marked region scrubbed in place so the rest of the file
 * (the real pipeline, the rest of the doc) survives.
 */
export const FILES_WITH_TEMPLATE_ONLY_BLOCKS: readonly string[] = [
  'build/azure-pipelines.yml',
  'doc/AzurePipelines.md',
];

/**
 * Scrubs the `template-only` regions from {@link FILES_WITH_TEMPLATE_ONLY_BLOCKS}
 * in place. Returns the files it changed. Idempotent — safe to run when the
 * regions are already gone.
 */
export function stripTemplateOnlyPipelineStages(root: string): string[] {
  const changed: string[] = [];
  for (const relativePath of FILES_WITH_TEMPLATE_ONLY_BLOCKS) {
    const target = join(root, relativePath);
    if (!existsSync(target)) {
      continue;
    }
    const original = readFileSync(target, 'utf8');
    const updated = stripTemplateOnlyBlocks(original);
    if (updated !== original) {
      writeFileSync(target, updated);
      changed.push(relativePath);
    }
  }
  return changed;
}

/** Outcome of a generation run, returned for logging and testing. */
export interface GenerationResult {
  readonly identifiers: Identifiers;
  readonly filesScanned: number;
  readonly filesChanged: number;
  readonly replacements: number;
  readonly deleted: readonly string[];
  readonly unwired: readonly string[];
  readonly readmeWritten: boolean;
  /** Absolute paths of every file the run wrote, for an optional format pass. */
  readonly changedFiles: readonly string[];
  readonly dryRun: boolean;
}

/**
 * Performs the substitution, README rewrite, and cleanup against `root`.
 * Assumes the arguments have already been validated into `identifiers`.
 */
export function generate(
  root: string,
  identifiers: Identifiers,
  options: { readonly dryRun?: boolean; readonly keepTemplateFiles?: boolean } = {},
): GenerationResult {
  const { dryRun = false, keepTemplateFiles = false } = options;
  const replacements = buildReplacements(identifiers);

  const files = collectTextFiles(root);
  const changedFiles: string[] = [];
  let totalReplacements = 0;

  for (const file of files) {
    const original = readFileSync(file, 'utf8');
    const { content, count } = applyReplacements(original, replacements);
    if (count > 0) {
      changedFiles.push(file);
      totalReplacements += count;
      if (!dryRun) {
        writeFileSync(file, content);
      }
    }
  }

  const readmePath = join(root, 'README.md');
  const readmeWritten = true;
  if (!dryRun) {
    writeFileSync(readmePath, renderAppReadme(identifiers));
  }

  const deleted: string[] = [];
  let unwired: string[] = [];
  if (!keepTemplateFiles) {
    for (const relativePath of TEMPLATE_ONLY_PATHS) {
      const target = resolve(root, relativePath);
      if (existsSync(target)) {
        deleted.push(relativePath);
        if (!dryRun) {
          rmSync(target, { recursive: true, force: true });
        }
      }
    }
    // Once the cli folder is removed, its references in the tooling would break
    // the quality gates; strip them so the generated project stays green. Also
    // scrub the template-only CI stage (and its doc) that drive this generator —
    // they reference the now-deleted cli/ and are meaningless in a generated app.
    if (!dryRun) {
      unwired = [...unwireGeneratorTooling(root), ...stripTemplateOnlyPipelineStages(root)];
    }
  }

  // Every file the run mutated, for the caller's optional formatting pass.
  const touched = [...changedFiles, readmePath, ...unwired.map((rel) => join(root, rel))].filter(
    (file) => existsSync(file),
  );

  return {
    identifiers,
    filesScanned: files.length,
    filesChanged: changedFiles.length,
    replacements: totalReplacements,
    deleted,
    unwired,
    readmeWritten,
    changedFiles: touched,
    dryRun,
  };
}

/** The `--help` / usage text. */
export const USAGE = `Rename this template into a new application.

Usage:
  yarn generate --name <AppName> --bundle-id <id> [options]

Required:
  --name <string>        App display name, e.g. "Acme App".
  --bundle-id <string>   Production application id / Android package,
                         e.g. com.acme.acmeapp. A dev/staging variant with an
                         "internal" segment (com.acme.internal.acmeapp) is
                         derived automatically.

Optional:
  --slug <string>        npm package name + Expo slug. Default: derived from --name.
  --dir <path>           Project root to transform. Default: current directory.
  --keep-template-files  Keep governance/template files (.github, LICENSE, ...).
  --dry-run              Report the plan without writing anything.
  -h, --help             Show this help.

Get the template first (any one of):
  npx degit nventive/ReactNativeApplicationTemplate my-app
  npx create-expo-app my-app --template <tarball-url>
  GitHub "Use this template"
Then, from inside the checkout: yarn install && yarn generate ...`;

/**
 * Reformats the given files with the project's Prettier config. Substitution
 * changes line lengths (a shorter/longer identifier can make a line wrap
 * differently), so without this the generated project can fail `yarn lint`
 * on formatting alone. Best-effort: if Prettier cannot be loaded the pass is
 * skipped rather than failing generation.
 */
export async function formatFiles(
  files: readonly string[],
  logger: Logger,
  prettierModule?: typeof import('prettier'),
): Promise<string[]> {
  let prettier: typeof import('prettier');
  if (prettierModule) {
    prettier = prettierModule;
  } else {
    try {
      prettier = await import('prettier');
    } catch {
      logger.info(
        '  (Prettier not available — skipping the formatting pass; run `yarn lint:fix`.)',
      );
      return [];
    }
  }

  const formatted: string[] = [];
  for (const file of files) {
    try {
      const info = await prettier.getFileInfo(file, { resolveConfig: true });
      if (info.ignored || !info.inferredParser) {
        continue;
      }
      const config = await prettier.resolveConfig(file);
      const source = readFileSync(file, 'utf8');
      const output = await prettier.format(source, { ...config, filepath: file });
      if (output !== source) {
        writeFileSync(file, output);
      }
      formatted.push(file);
    } catch {
      // A single unformattable file must not abort the run.
    }
  }
  return formatted;
}

/**
 * CLI entry: parses, validates, and runs. Returns a process exit code
 * (0 success, 2 usage error, 1 unexpected failure). Never throws.
 */
export async function run(
  argv: readonly string[],
  options: { readonly cwd?: string; readonly logger?: Logger; readonly format?: boolean } = {},
): Promise<number> {
  const logger = options.logger ?? consoleLogger;
  const cwd = options.cwd ?? process.cwd();
  const format = options.format ?? true;

  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    logger.info('');
    logger.info(USAGE);
    return 2;
  }

  if (args.help) {
    logger.info(USAGE);
    return 0;
  }

  const resolution = resolveIdentifiers(args);
  if (!resolution.ok) {
    for (const message of resolution.errors) {
      logger.error(message);
    }
    logger.info('');
    logger.info(USAGE);
    return 2;
  }

  const root = resolve(cwd, args.dir ?? '.');
  const appConfig = join(root, 'app.config.ts');
  if (!existsSync(appConfig) || !statSync(root).isDirectory()) {
    logger.error(`"${root}" does not look like the template root (app.config.ts not found).`);
    return 2;
  }

  const { identifiers } = resolution;
  const { dryRun, keepTemplateFiles } = args;

  try {
    const result = generate(root, identifiers, { dryRun, keepTemplateFiles });

    let formattedCount = 0;
    if (!dryRun && format) {
      formattedCount = (await formatFiles(result.changedFiles, logger)).length;
    }

    logger.info(dryRun ? 'Dry run — no files modified.' : `Generated ${identifiers.appName}.`);
    logger.info(`  name:            ${identifiers.appName}`);
    logger.info(`  slug:            ${identifiers.slug}`);
    logger.info(`  bundle id:       ${identifiers.baseBundleId}`);
    logger.info(`  bundle (dev):    ${identifiers.internalBundleId}`);
    logger.info(
      `  files:           ${result.replacements} replacement(s) in ${result.filesChanged} of ${result.filesScanned} file(s)`,
    );
    logger.info(`  README.md:       ${dryRun ? 'would be rewritten' : 'rewritten'}`);
    if (result.deleted.length > 0) {
      logger.info(
        `  removed:         ${result.deleted.join(', ')}${dryRun ? ' (would remove)' : ''}`,
      );
    }
    if (result.unwired.length > 0) {
      logger.info(`  updated tooling: ${result.unwired.join(', ')}`);
    }
    if (formattedCount > 0) {
      logger.info(`  formatted:       ${formattedCount} file(s)`);
    }
    if (!dryRun) {
      logger.info('');
      logger.info('Next: yarn install && yarn typecheck && yarn lint && yarn test');
    }
    return 0;
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
