/**
 * A semantic app version (`major.minor.patch[.build]`). Forced update compares
 * the installed version against the remote minimum with {@link compareVersions},
 * so the comparison rules here are correctness-critical.
 *
 * `build` is optional; a version without a build sorts **before** the same
 * version with a build (a null build is treated as lesser than any concrete
 * build).
 */
export interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly build?: number;
}

/** Constructs a {@link Version}, defaulting the missing components to 0. */
export function version(major: number, minor = 0, patch = 0, build?: number): Version {
  return build === undefined ? { major, minor, patch } : { major, minor, patch, build };
}

/**
 * Parses a `"major.minor.patch"` or `"major.minor.patch.build"` string, or
 * returns `undefined` if it is not a valid version (fail-soft — callers decide
 * whether to fall back to a default). Total instead of throwing, so
 * remote/persisted values fail soft.
 */
export function tryParseVersion(raw: string): Version | undefined {
  const segments = raw.trim().split('.');
  if (segments.length < 3 || segments.length > 4) {
    return undefined;
  }

  const numbers = segments.map((segment) => {
    // Reject empty / non-integer / negative segments — "1.2" already failed the
    // length check; "1.2.x" or "1.-2.3" fail here.
    if (!/^\d+$/.test(segment)) {
      return Number.NaN;
    }
    return Number.parseInt(segment, 10);
  });

  if (numbers.some((n) => Number.isNaN(n))) {
    return undefined;
  }

  const [major, minor, patch, build] = numbers;
  return build === undefined ? { major, minor, patch } : { major, minor, patch, build };
}

/** Formats a {@link Version} back to its `major.minor.patch[.build]` string. */
export function formatVersion(v: Version): string {
  const core = `${v.major}.${v.minor}.${v.patch}`;
  return v.build === undefined ? core : `${core}.${v.build}`;
}

/**
 * Compares two versions, returning a negative number when `a < b`, `0` when they
 * are equal, and a positive number when `a > b`. Components are compared in
 * order (major, minor, patch, build); a missing `build` is treated as lesser
 * than any concrete build, and two missing builds are equal.
 */
export function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  const aBuild = a.build;
  const bBuild = b.build;
  if (aBuild === bBuild) return 0;
  if (aBuild === undefined) return -1;
  if (bBuild === undefined) return 1;
  return aBuild - bBuild;
}
