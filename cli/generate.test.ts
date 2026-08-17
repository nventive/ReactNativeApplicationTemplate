import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  applyReplacements,
  buildReplacements,
  collectTextFiles,
  deriveInternalBundleId,
  formatFiles,
  generate,
  type Identifiers,
  type Logger,
  parseArgs,
  renderAppReadme,
  resolveIdentifiers,
  run,
  slugify,
  stripTemplateOnlyBlocks,
  TEMPLATE_IDENTIFIERS,
} from './generate.ts';

const ACME: Identifiers = {
  appName: 'Acme App',
  slug: 'acme-app',
  baseBundleId: 'com.acme.acmeapp',
  internalBundleId: 'com.acme.internal.acmeapp',
};

function capturingLogger(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const logger: Logger = {
    info: (m) => lines.push(m),
    warn: (m) => lines.push(m),
    error: (m) => lines.push(m),
  };
  return { logger, lines };
}

describe('parseArgs', () => {
  it('parses value flags in both spaced and = forms', () => {
    const parsed = parseArgs(['--name', 'Acme App', '--bundle-id=com.acme.acmeapp', '--slug', 'x']);
    expect(parsed.name).toBe('Acme App');
    expect(parsed.bundleId).toBe('com.acme.acmeapp');
    expect(parsed.slug).toBe('x');
  });

  it('parses boolean flags', () => {
    const parsed = parseArgs(['--dry-run', '--keep-template-files', '-h']);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.keepTemplateFiles).toBe(true);
    expect(parsed.help).toBe(true);
  });

  it('throws on an unknown flag', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown argument/);
  });

  it('throws on a value flag with no value', () => {
    expect(() => parseArgs(['--name'])).toThrow(/Missing value/);
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Acme App!')).toBe('acme-app');
    expect(slugify('  Foo   Bar  ')).toBe('foo-bar');
  });
});

describe('deriveInternalBundleId', () => {
  it('inserts an internal segment before the last', () => {
    expect(deriveInternalBundleId('com.acme.acmeapp')).toBe('com.acme.internal.acmeapp');
    expect(deriveInternalBundleId('io.foo')).toBe('io.internal.foo');
  });
});

describe('resolveIdentifiers', () => {
  it('resolves and derives slug + internal id', () => {
    const res = resolveIdentifiers(
      parseArgs(['--name', 'Acme App', '--bundle-id', 'com.acme.acmeapp']),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.identifiers).toEqual(ACME);
    }
  });

  it('honours an explicit slug', () => {
    const res = resolveIdentifiers(
      parseArgs(['--name', 'Acme App', '--bundle-id', 'com.acme.acmeapp', '--slug', 'custom-slug']),
    );
    expect(res.ok && res.identifiers.slug).toBe('custom-slug');
  });

  it('rejects a missing name', () => {
    const res = resolveIdentifiers(parseArgs(['--bundle-id', 'com.acme.acmeapp']));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(' ')).toMatch(/--name is required/);
  });

  it('rejects an invalid bundle id (uppercase / too few segments / hyphen)', () => {
    for (const id of ['Com.Acme.App', 'acme', 'com.acme.acme-app']) {
      const res = resolveIdentifiers(parseArgs(['--name', 'Acme', '--bundle-id', id]));
      expect(res.ok).toBe(false);
    }
  });

  it('rejects an invalid explicit slug', () => {
    const res = resolveIdentifiers(
      parseArgs(['--name', 'Acme', '--bundle-id', 'com.acme.acme', '--slug', 'Bad Slug']),
    );
    expect(res.ok).toBe(false);
  });
});

describe('buildReplacements', () => {
  it('orders longest source first so ids never partially match', () => {
    const froms = buildReplacements(ACME).map((r) => r.from);
    const sorted = [...froms].sort((a, b) => b.length - a.length);
    expect(froms).toEqual(sorted);
    // The internal (longer) bundle id must precede the base one.
    expect(froms.indexOf(TEMPLATE_IDENTIFIERS.internalBundleId)).toBeLessThan(
      froms.indexOf(TEMPLATE_IDENTIFIERS.baseBundleId),
    );
  });
});

describe('applyReplacements', () => {
  it('distinguishes the internal and base bundle ids', () => {
    const input = [
      TEMPLATE_IDENTIFIERS.internalBundleId,
      TEMPLATE_IDENTIFIERS.baseBundleId,
      TEMPLATE_IDENTIFIERS.appName,
      TEMPLATE_IDENTIFIERS.slug,
    ].join('\n');
    const { content, count } = applyReplacements(input, buildReplacements(ACME));
    expect(content).toBe(
      ['com.acme.internal.acmeapp', 'com.acme.acmeapp', 'Acme App', 'acme-app'].join('\n'),
    );
    expect(count).toBe(4);
    expect(content).not.toContain('nventive');
    expect(content).not.toContain('reactnativeapptemplate');
  });
});

describe('renderAppReadme', () => {
  it('includes the app name and points at app.config.ts', () => {
    const readme = renderAppReadme(ACME);
    expect(readme).toContain('# Acme App');
    expect(readme).toContain('app.config.ts');
  });
});

describe('stripTemplateOnlyBlocks', () => {
  it('removes a begin..end region inclusive and collapses the gap to one blank line', () => {
    const input = [
      'keep-before',
      '',
      '# template-only:begin — note',
      'drop-1',
      'drop-2',
      '# template-only:end',
      '',
      'keep-after',
      '',
    ].join('\n');
    const output = stripTemplateOnlyBlocks(input);
    expect(output).not.toContain('drop-1');
    expect(output).not.toContain('drop-2');
    expect(output).not.toContain('template-only');
    expect(output).toContain('keep-before');
    expect(output).toContain('keep-after');
    expect(output).not.toMatch(/\n{3,}/); // no blank-line pile-up
  });

  it('is a no-op on content with no markers', () => {
    const input = 'a\nb\nc\n';
    expect(stripTemplateOnlyBlocks(input)).toBe(input);
  });

  it('handles more than one region', () => {
    const input = [
      'a',
      '# template-only:begin',
      'x',
      '# template-only:end',
      'b',
      '<!-- template-only:begin -->',
      'y',
      '<!-- template-only:end -->',
      'c',
    ].join('\n');
    const output = stripTemplateOnlyBlocks(input);
    expect(output).not.toMatch(/x|y|template-only/);
    expect(output.split('\n').filter(Boolean)).toEqual(['a', 'b', 'c']);
  });

  it('ignores a prose mention of the tokens (only comment-prefixed markers count)', () => {
    const input = [
      'keep',
      '<!-- template-only:begin -->',
      'A paragraph that names the `template-only:end` token mid-sentence.',
      'still inside the block',
      '<!-- template-only:end -->',
      'kept-after',
    ].join('\n');
    const output = stripTemplateOnlyBlocks(input);
    // The prose line did NOT end the block early, so everything up to the real
    // marker is gone and only the surrounding content remains.
    expect(output).not.toContain('paragraph that names');
    expect(output).not.toContain('still inside the block');
    expect(output).not.toContain('template-only');
    expect(output.split('\n').filter(Boolean)).toEqual(['keep', 'kept-after']);
  });
});

describe('generate (filesystem)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'rn-gen-'));
    // A representative slice of the template tree.
    writeFileSync(
      join(root, 'app.config.ts'),
      `const config = {\n  name: '${TEMPLATE_IDENTIFIERS.appName}',\n  slug: '${TEMPLATE_IDENTIFIERS.slug}',\n  ios: { bundleIdentifier: '${TEMPLATE_IDENTIFIERS.internalBundleId}' },\n  android: { package: '${TEMPLATE_IDENTIFIERS.internalBundleId}' },\n};\n`,
    );
    writeFileSync(
      join(root, 'package.json'),
      `${JSON.stringify(
        {
          name: TEMPLATE_IDENTIFIERS.slug,
          scripts: {
            typecheck: 'tsc --noEmit && tsc --noEmit -p cli/tsconfig.json',
            generate: 'node cli/index.ts',
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(root, 'jest.config.js'),
      "module.exports = {\n  roots: ['<rootDir>/src', '<rootDir>/test', '<rootDir>/cli'],\n};\n",
    );
    mkdirSync(join(root, 'e2e', 'flows'), { recursive: true });
    writeFileSync(
      join(root, 'e2e', 'flows', 'launch.yaml'),
      `appId: ${TEMPLATE_IDENTIFIERS.internalBundleId}\n`,
    );
    mkdirSync(join(root, 'build', 'templates'), { recursive: true });
    writeFileSync(
      join(root, 'build', 'pipeline.yml'),
      `staging: ${TEMPLATE_IDENTIFIERS.internalBundleId}.jks\nprod: ${TEMPLATE_IDENTIFIERS.baseBundleId}.jks\n`,
    );
    // Template-only CI steps template: removed, but the rest of build/ is kept.
    writeFileSync(join(root, 'build', 'templates', 'template-validation.yml'), 'steps: []\n');
    // The main pipeline carries a Template_Validation stage bracketed by markers;
    // the generator strips the marked region and keeps every other stage.
    writeFileSync(
      join(root, 'build', 'azure-pipelines.yml'),
      [
        'stages:',
        '  - stage: Verify',
        '    jobs: []',
        '  # template-only:begin — validates the generator',
        '  - stage: Template_Validation',
        '    jobs:',
        '      - template: templates/template-validation.yml',
        '  # template-only:end',
        '  - stage: Build_Staging',
        '    jobs: []',
        '',
      ].join('\n'),
    );
    // The pipeline doc carries the same marked region.
    mkdirSync(join(root, 'doc'), { recursive: true });
    writeFileSync(
      join(root, 'doc', 'AzurePipelines.md'),
      [
        '# Azure Pipelines',
        '',
        'Real content that stays.',
        '',
        '<!-- template-only:begin -->',
        '## Template-validation stage',
        'Explains the generator-only stage.',
        '<!-- template-only:end -->',
        '',
        '## Signing',
        '',
      ].join('\n'),
    );
    // A binary-ish file that must be left untouched.
    writeFileSync(join(root, 'icon.png'), TEMPLATE_IDENTIFIERS.appName);
    // Governance / template-only artifacts.
    writeFileSync(join(root, 'LICENSE'), 'Apache 2.0');
    writeFileSync(join(root, 'BREAKING_CHANGES.md'), '# Breaking Changes');
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'name: ci');
    // The generator's own folder holds the identifiers as data — must be excluded.
    mkdirSync(join(root, 'cli'), { recursive: true });
    writeFileSync(
      join(root, 'cli', 'generate.ts'),
      `const from = '${TEMPLATE_IDENTIFIERS.appName}';`,
    );
    writeFileSync(join(root, 'README.md'), '# Template');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('replaces every identifier in text files and leaves binaries alone', () => {
    const result = generate(root, ACME);

    const appConfig = readFileSync(join(root, 'app.config.ts'), 'utf8');
    expect(appConfig).toContain("name: 'Acme App'");
    expect(appConfig).toContain("slug: 'acme-app'");
    expect(appConfig).toContain("bundleIdentifier: 'com.acme.internal.acmeapp'");

    expect(readFileSync(join(root, 'package.json'), 'utf8')).toContain('"name": "acme-app"');
    expect(readFileSync(join(root, 'e2e', 'flows', 'launch.yaml'), 'utf8')).toBe(
      'appId: com.acme.internal.acmeapp\n',
    );
    expect(readFileSync(join(root, 'build', 'pipeline.yml'), 'utf8')).toBe(
      'staging: com.acme.internal.acmeapp.jks\nprod: com.acme.acmeapp.jks\n',
    );

    // Untouched binary.
    expect(readFileSync(join(root, 'icon.png'), 'utf8')).toBe(TEMPLATE_IDENTIFIERS.appName);

    expect(result.filesChanged).toBeGreaterThanOrEqual(4);
    expect(result.replacements).toBeGreaterThanOrEqual(6);
  });

  it('never leaves an old identifier behind in scanned files', () => {
    generate(root, ACME);
    for (const file of collectTextFiles(root)) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toContain('reactnativeapptemplate');
      expect(content).not.toContain('React Native App Template');
    }
  });

  it('does not rewrite the cli folder when kept', () => {
    generate(root, ACME, { keepTemplateFiles: true });
    expect(readFileSync(join(root, 'cli', 'generate.ts'), 'utf8')).toContain(
      TEMPLATE_IDENTIFIERS.appName,
    );
  });

  it('removes template-only files and rewrites the README', () => {
    const result = generate(root, ACME);
    expect(existsSync(join(root, 'LICENSE'))).toBe(false);
    expect(existsSync(join(root, 'BREAKING_CHANGES.md'))).toBe(false);
    expect(existsSync(join(root, '.github'))).toBe(false);
    expect(existsSync(join(root, 'cli'))).toBe(false);
    // The template-validation steps template goes, but the rest of build/ stays.
    expect(existsSync(join(root, 'build', 'templates', 'template-validation.yml'))).toBe(false);
    expect(existsSync(join(root, 'build', 'pipeline.yml'))).toBe(true);
    expect(result.deleted).toEqual(
      expect.arrayContaining([
        'LICENSE',
        '.github',
        'build/templates/template-validation.yml',
        'cli',
      ]),
    );
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toContain('# Acme App');
  });

  it('strips the template-only stage from the pipeline and doc, keeping the rest', () => {
    const result = generate(root, ACME);

    const pipeline = readFileSync(join(root, 'build', 'azure-pipelines.yml'), 'utf8');
    expect(pipeline).not.toContain('Template_Validation');
    expect(pipeline).not.toContain('template-only');
    // Surrounding stages survive.
    expect(pipeline).toContain('stage: Verify');
    expect(pipeline).toContain('stage: Build_Staging');

    const doc = readFileSync(join(root, 'doc', 'AzurePipelines.md'), 'utf8');
    expect(doc).not.toContain('template-only');
    expect(doc).not.toContain('Template-validation stage');
    expect(doc).toContain('Real content that stays.');
    expect(doc).toContain('## Signing');

    expect(result.unwired).toEqual(
      expect.arrayContaining(['build/azure-pipelines.yml', 'doc/AzurePipelines.md']),
    );
  });

  it('un-wires the generator from package.json and jest.config.js when cli is removed', () => {
    const result = generate(root, ACME);
    expect(result.unwired).toEqual(expect.arrayContaining(['package.json', 'jest.config.js']));

    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.scripts.generate).toBeUndefined();
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit');

    const jestConfig = readFileSync(join(root, 'jest.config.js'), 'utf8');
    expect(jestConfig).not.toContain('cli');
    expect(jestConfig).toContain("'<rootDir>/src', '<rootDir>/test'");
  });

  it('keeps template files and tooling when asked', () => {
    generate(root, ACME, { keepTemplateFiles: true });
    expect(existsSync(join(root, 'LICENSE'))).toBe(true);
    expect(existsSync(join(root, '.github'))).toBe(true);
    expect(existsSync(join(root, 'build', 'templates', 'template-validation.yml'))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.scripts.generate).toBe('node cli/index.ts');
    // The template-only stage is left in place when template files are kept.
    expect(readFileSync(join(root, 'build', 'azure-pipelines.yml'), 'utf8')).toContain(
      'Template_Validation',
    );
  });

  it('writes nothing on a dry run', () => {
    const before = readFileSync(join(root, 'app.config.ts'), 'utf8');
    const result = generate(root, ACME, { dryRun: true });
    expect(readFileSync(join(root, 'app.config.ts'), 'utf8')).toBe(before);
    expect(existsSync(join(root, 'LICENSE'))).toBe(true);
    expect(result.filesChanged).toBeGreaterThanOrEqual(4);
    expect(result.deleted.length).toBeGreaterThan(0);
  });
});

describe('formatFiles', () => {
  // Prettier v3 uses dynamic import() internally, which jest's VM cannot run, so
  // the orchestration is tested against an injected fake; the real Prettier pass
  // is covered by the end-to-end generation check.
  const fakePrettier = (over: Partial<Record<string, unknown>> = {}) =>
    ({
      getFileInfo: async () => ({ ignored: false, inferredParser: 'typescript' }),
      resolveConfig: async () => ({}),
      format: async (source: string) => `${source.replace(/\s+/g, ' ').trim()}\n`,
      ...over,
    }) as unknown as typeof import('prettier');

  it('reformats each file and reports it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rn-fmt-'));
    try {
      const file = join(dir, 'sample.ts');
      writeFileSync(file, 'const   x =   1\n');
      const { logger } = capturingLogger();
      const formatted = await formatFiles([file], logger, fakePrettier());
      expect(formatted).toEqual([file]);
      expect(readFileSync(file, 'utf8')).toBe('const x = 1\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips ignored files and files with no parser', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rn-fmt-'));
    try {
      const file = join(dir, 'ignored.ts');
      writeFileSync(file, 'const   x =   1\n');
      const { logger } = capturingLogger();
      const ignored = fakePrettier({ getFileInfo: async () => ({ ignored: true }) });
      expect(await formatFiles([file], logger, ignored)).toEqual([]);
      expect(readFileSync(file, 'utf8')).toBe('const   x =   1\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('degrades gracefully (returns an array, never throws) when Prettier is unavailable', async () => {
    const { logger } = capturingLogger();
    // No injected module + jest cannot dynamic-import → the best-effort skip path.
    await expect(formatFiles(['/no/such/file.ts'], logger)).resolves.toEqual(expect.any(Array));
  });
});

describe('run', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'rn-run-'));
    writeFileSync(join(root, 'app.config.ts'), `name: '${TEMPLATE_IDENTIFIERS.appName}'`);
    writeFileSync(join(root, 'README.md'), '# Template');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns 0 and transforms the project on success', async () => {
    const { logger, lines } = capturingLogger();
    const code = await run(
      ['--name', 'Acme App', '--bundle-id', 'com.acme.acmeapp', '--dir', root],
      { logger, format: false },
    );
    expect(code).toBe(0);
    expect(readFileSync(join(root, 'app.config.ts'), 'utf8')).toContain('Acme App');
    expect(lines.join('\n')).toContain('Generated Acme App.');
  });

  it('returns 0 and prints usage for --help', async () => {
    const { logger, lines } = capturingLogger();
    expect(await run(['--help'], { logger })).toBe(0);
    expect(lines.join('\n')).toContain('Usage:');
  });

  it('returns 2 on a usage error', async () => {
    const { logger } = capturingLogger();
    expect(await run(['--bundle-id', 'com.acme.acmeapp', '--dir', root], { logger })).toBe(2);
  });

  it('returns 2 when the directory is not the template root', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'rn-empty-'));
    try {
      const { logger } = capturingLogger();
      expect(
        await run(['--name', 'Acme', '--bundle-id', 'com.acme.acme', '--dir', empty], { logger }),
      ).toBe(2);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
