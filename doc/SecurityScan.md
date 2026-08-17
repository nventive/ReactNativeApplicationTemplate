# Security Scan

The template ships **two complementary security scans**:

1. A **supply-chain (SCA) dependency audit** — the baseline, built for the
   JavaScript/React Native ecosystem (nightly, non-blocking).
2. **Binary SAST with MobSF** — static analysis over the signed `.apk`/`.aab`/`.ipa`
   the delivery pipeline produces (per build, non-blocking).

One scans the **dependency tree**, the other the **app binary**; together they
cover both halves of the risk surface.

## Why the SCA audit is the baseline

MobSF static analysis (SAST) runs over a *built* IPA and AAB. That is valuable —
and now shipped (see [Binary SAST (MobSF)](#binary-sast-mobsf)) — but for a JS/RN
app the dominant risk surface is the **dependency tree**: hundreds of transitive
npm packages pulled in by Expo, React Native, and tooling. So the baseline scan
is a **dependency audit** (`yarn audit`, backed by the GitHub/npm advisory
database), the JS-supply-chain equivalent of "scan the artifact for known issues."

Both scans follow the same principles:

- Produce a **machine-readable JSON report** for triage.
- Run **non-blocking** — **never** a PR gate: PRs should not be blocked when an
  advisory API is down or a scanner flags the binary.
- Triage off the JSON/report; accept residual risk explicitly.

## The tool

| Piece | Role |
|-------|------|
| `yarn audit` | Queries the advisory DB for known vulnerabilities in the committed `yarn.lock`. |
| [`scripts/security-audit.mjs`](../scripts/security-audit.mjs) | Wraps `yarn audit --json --groups dependencies` (the production dependency tree): dedupes advisories, applies the allowlist + severity threshold, writes the JSON report, prints a summary, and sets the exit code. |
| [`security/audit-allowlist.json`](../security/audit-allowlist.json) | The triage allowlist — advisories accepted (with a reason + expiry). Committed. |
| `security/audit-report.json` | The generated report (gitignored; a CI artifact). |

Run it locally:

```bash
yarn audit:scan            # threshold "high"; exits non-zero on actionable findings
yarn audit:scan --no-fail  # report only (exit 0) — what the nightly CI job uses
yarn audit                 # the raw underlying audit, if you want the full detail
```

Useful flags: `--threshold=moderate|high|critical`, `--report=<path>`,
`--allowlist=<path>`, `--strict` (fail if the audit can't run), `--no-fail`
(report only).

## Triage policy

1. **Severity threshold — default `high`.** Only advisories at or above the
   threshold (and not allowlisted) are **actionable** and set a non-zero exit.
   `moderate`/`low`/`info` are recorded in the report but do not fail the scan.
   Change the default in `security/audit-allowlist.json` (`"threshold"`) or per
   run with `--threshold`.
2. **Fix first.** For an actionable advisory, prefer to upgrade: bump the direct
   dependency, or add a `resolutions` entry (Yarn) to force a patched transitive
   version, then re-run `yarn audit:scan`.
3. **Accept explicitly, with an expiry.** If a fix is not yet available (common
   for deep transitive advisories with no upstream patch yet), add an allowlist
   entry — with a
   written **reason** and an **`expires`** date. Expired entries stop suppressing
   and are surfaced in the report as *re-triage required*, so accepted risk can
   never silently rot.
4. **The nightly job is non-blocking.** It publishes the report and records
   findings; it does not fail the pipeline. Review it and open follow-up work —
   do not let it become wallpaper.

### Accepting an advisory

Add an entry to `security/audit-allowlist.json`. Match by numeric `id`, GHSA id
(`ghsa`), or `module`:

```jsonc
{
  "threshold": "high",
  "advisories": [
    {
      "ghsa": "GHSA-w3rx-r6r6-pgpr",
      "module": "image-size",
      "reason": "Transitive via Expo CLI; the DoS parser path is not reachable at runtime. Tracking upstream bump in <ticket>.",
      "expires": "2026-12-31"
    }
  ]
}
```

The scan then reports it under `suppressed` instead of `actionable`. When
`expires` passes, it reappears as actionable and as an *expired allowlist entry*.

## CI (dependency audit)

The dependency audit runs in Azure Pipelines as a **scheduled (nightly),
non-blocking** `Security_Scan` stage (the MobSF binary scan has its own per-build
stages — see [Binary SAST (MobSF)](#binary-sast-mobsf); and
[AzurePipelines.md](AzurePipelines.md),
[`build/templates/security-audit.yml`](../build/templates/security-audit.yml)):

- Node + `yarn install --frozen-lockfile`.
- `node scripts/security-audit.mjs --no-fail` (report-only; the stage never
  blocks a build).
- Publishes `security/audit-report.json` as the `Security_Report` artifact for
  triage.

It is deliberately **absent from the PR gate** (`Commit_Validation` / `Verify`) —
a red advisory DB, or a newly-disclosed transitive CVE, must never block an
unrelated PR from merging.

## Binary SAST (MobSF)

Artifact-level static analysis over the signed builds the delivery pipeline
produces (`.apk`/`.aab` from Gradle, `.ipa` from Xcode, both via `expo prebuild`).

**How it runs.** [`build/templates/mobsf-scan.yml`](../build/templates/mobsf-scan.yml)
starts [MobSF](https://mobsf.github.io/docs/) as a container on the agent, then
drives its REST API: `upload → scan → download PDF + JSON`, publishing both
reports as a `<artifactName>_Security_Reports` build artifact. It runs on Linux
regardless of platform — MobSF analyses an `.ipa` on Linux just as well as an
`.aab`. The scan **reuses MobSF's own file-type detection** from the upload
response, so it handles apk vs. aab vs. ipa without per-type branching.

**When it runs.** Two stages in [`azure-pipelines.yml`](../build/azure-pipelines.yml):

| Stage | Scans | Runs on |
|-------|-------|---------|
| `Security_Scan_Staging` | `Android_Staging` (apk) + `iOS_Staging` (ipa) | every non-PR build (post-merge) |
| `Security_Scan_Production` | `Android_Production` (aab) + `iOS_Production` (ipa) | the release branch |

Both are **non-blocking** — they publish reports for triage and never fail the
build. The staging scan is gated **off PRs** (like the Maestro device stage) to
keep PRs fast; to also scan on PRs, drop the `IsPullRequestBuild` condition on
`Security_Scan_Staging` (it adds a dockerized MobSF run to every PR).

**Configuration** (in [`variables.yml`](../build/variables.yml)):
`dockerVersion` (the Docker CLI `DockerInstaller@0` ensures), `mobsfImageTag`
(pin to a concrete tag/digest for reproducibility — defaults to `latest` so a
fresh clone works), and `mobSfApiKey` (the local throwaway container's API key —
**not** a secret; it never leaves the agent).

**Making it a gate.** To fail the build past a severity threshold, parse the
published `report.json` after the scan step (e.g. counts under `appsec` /
`.appsec.high`) and exit non-zero — the same "threshold + explicit acceptance"
model the SCA audit uses. Left non-blocking by default so a scanner heuristic
never blocks a release on its own.

**Prerequisites.** The scan needs the signed-artifact stages (`Build_Staging` /
`Build_Production`) to run — i.e. the same signing/native setup those stages
require (see [AzurePipelines.md](AzurePipelines.md)). It needs no service
connection or store credentials of its own; the MobSF container is
self-contained.
