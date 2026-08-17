#!/usr/bin/env node
/**
 * Dependency (SCA) security scan (`doc/SecurityScan.md`). It runs `yarn audit`
 * against the committed `yarn.lock`, applies the triage allowlist, and produces a
 * machine-readable JSON report plus a human summary for triage.
 *
 * Policy: this is meant to run as a **scheduled, non-blocking** CI job, not a PR
 * gate — PRs should not be blocked when the advisory API is down. So a registry
 * that is unreachable is reported and treated as non-fatal; only *actionable*
 * advisories (at/above the threshold and not allowlisted) set a non-zero exit,
 * which a developer can opt into locally.
 *
 * Usage:
 *   node scripts/security-audit.mjs [--threshold=high] [--report=security/audit-report.json]
 *                                   [--allowlist=security/audit-allowlist.json]
 *                                   [--no-fail] [--strict]
 *
 * See doc/SecurityScan.md for the triage policy and how to accept an advisory.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];

function parseArgs(argv) {
  const args = { flags: new Set(), values: {} };
  for (const arg of argv) {
    if (arg === '--no-fail' || arg === '--strict') {
      args.flags.add(arg.slice(2));
      continue;
    }
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) {
      args.values[match[1]] = match[2];
    }
  }
  return args;
}

/** Runs `yarn audit --json` and returns its raw NDJSON stdout (or null on failure). */
function runYarnAudit() {
  const result = spawnSync('yarn', ['audit', '--json', '--groups', 'dependencies'], {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  // `yarn audit` exits with a non-zero bitmask when it *finds* vulnerabilities;
  // that is a successful run, not an error. A genuine failure (registry down,
  // yarn missing) yields no parseable summary — handled by the caller.
  if (result.error) {
    return { stdout: null, error: result.error.message };
  }
  return { stdout: result.stdout ?? '', error: null };
}

/** Parses NDJSON audit output into deduped advisories + the summary. */
function parseAudit(stdout) {
  const byId = new Map();
  let summary = null;

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let record;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue; // ignore any non-JSON noise
    }
    if (record.type === 'auditSummary') {
      summary = record.data;
    } else if (record.type === 'auditAdvisory') {
      const advisory = record.data.advisory ?? {};
      const path = record.data.resolution?.path;
      const existing = byId.get(advisory.id);
      if (existing) {
        if (path && !existing.paths.includes(path)) existing.paths.push(path);
      } else {
        byId.set(advisory.id, {
          id: advisory.id,
          ghsa: advisory.github_advisory_id ?? null,
          module: advisory.module_name ?? 'unknown',
          severity: advisory.severity ?? 'info',
          title: advisory.title ?? '',
          vulnerableVersions: advisory.vulnerable_versions ?? null,
          patchedVersions: advisory.patched_versions ?? null,
          url: advisory.url ?? null,
          paths: path ? [path] : [],
        });
      }
    }
  }
  return { advisories: [...byId.values()], summary };
}

function loadAllowlist(path) {
  if (!existsSync(path)) return { threshold: null, advisories: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return { threshold: parsed.threshold ?? null, advisories: parsed.advisories ?? [] };
  } catch (error) {
    console.error(`⚠  Could not read allowlist ${path}: ${error.message}`);
    return { threshold: null, advisories: [] };
  }
}

/** Today's date as YYYY-MM-DD, for allowlist-expiry comparison. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Finds the matching, non-expired allowlist entry for an advisory (or null). */
function matchAllowlist(advisory, allowlist, now) {
  for (const entry of allowlist.advisories) {
    const matches =
      (entry.id !== undefined && entry.id === advisory.id) ||
      (entry.ghsa !== undefined && entry.ghsa === advisory.ghsa) ||
      (entry.module !== undefined && entry.module === advisory.module);
    if (!matches) continue;
    if (entry.expires && entry.expires < now) {
      return { entry, expired: true };
    }
    return { entry, expired: false };
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const allowlistPath = resolve(args.values.allowlist ?? 'security/audit-allowlist.json');
  const reportPath = resolve(args.values.report ?? 'security/audit-report.json');
  const allowlist = loadAllowlist(allowlistPath);
  const threshold = (
    args.values.threshold ??
    process.env.SECURITY_AUDIT_THRESHOLD ??
    allowlist.threshold ??
    'high'
  ).toLowerCase();
  const thresholdRank = SEVERITY_ORDER.indexOf(threshold);
  const now = today();

  console.log(`▶ Dependency security scan (threshold: ${threshold}, allowlist: ${allowlistPath})`);

  const { stdout, error } = runYarnAudit();
  if (error || stdout === null) {
    console.error(`⚠  yarn audit could not run: ${error ?? 'no output'}`);
    if (args.flags.has('strict')) process.exit(2);
    console.error('   Not blocking (registry may be unreachable). See doc/SecurityScan.md.');
    process.exit(0);
  }

  const { advisories, summary } = parseAudit(stdout);
  if (!summary) {
    console.error('⚠  yarn audit produced no summary — treating as inconclusive.');
    if (args.flags.has('strict')) process.exit(2);
    process.exit(0);
  }

  const actionable = [];
  const suppressed = [];
  const expiredAllow = [];
  const belowThreshold = [];

  for (const advisory of advisories) {
    const match = matchAllowlist(advisory, allowlist, now);
    if (match && !match.expired) {
      suppressed.push({ ...advisory, reason: match.entry.reason ?? '' });
      continue;
    }
    if (match && match.expired) {
      expiredAllow.push({ ...advisory, expires: match.entry.expires });
    }
    if (SEVERITY_ORDER.indexOf(advisory.severity) >= thresholdRank) {
      actionable.push(advisory);
    } else {
      belowThreshold.push(advisory);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    threshold,
    tool: 'yarn audit',
    summary: summary.vulnerabilities,
    totalDependencies: summary.totalDependencies,
    counts: {
      actionable: actionable.length,
      suppressed: suppressed.length,
      belowThreshold: belowThreshold.length,
      expiredAllowlist: expiredAllow.length,
    },
    actionable,
    suppressed,
    belowThreshold,
    expiredAllowlist: expiredAllow,
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const v = summary.vulnerabilities;
  console.log(
    `  Findings by dependency path: critical ${v.critical}, high ${v.high}, moderate ${v.moderate}, low ${v.low}, info ${v.info}`,
  );
  console.log(
    `  Unique advisories: ${actionable.length} actionable (≥ ${threshold}), ${suppressed.length} allowlisted, ${belowThreshold.length} below threshold`,
  );
  console.log(`  Report: ${reportPath}`);

  for (const a of actionable) {
    console.log(`  ✖ [${a.severity}] ${a.module} — ${a.title} (${a.ghsa ?? a.id})`);
  }
  if (expiredAllow.length > 0) {
    console.log('  ⚠  Expired allowlist entries (re-triage required):');
    for (const a of expiredAllow) {
      console.log(`     - ${a.module} (${a.ghsa ?? a.id}) expired ${a.expires}`);
    }
  }

  if (actionable.length === 0) {
    console.log('✔ No actionable advisories.');
    process.exit(0);
  }
  if (args.flags.has('no-fail')) {
    console.log('  (--no-fail set — reporting only, exit 0)');
    process.exit(0);
  }
  process.exit(1);
}

main();
