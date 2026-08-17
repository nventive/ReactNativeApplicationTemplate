/**
 * Tier 1 — plain TS. The version parse/compare rules forced update depends on;
 * the build-vs-no-build ordering sorts a missing build below any concrete build.
 */
import {
  compareVersions,
  formatVersion,
  tryParseVersion,
  version,
} from '../../../src/access/version/Version';

describe('tryParseVersion', () => {
  it('parses major.minor.patch', () => {
    expect(tryParseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('parses an optional build component', () => {
    expect(tryParseVersion('1.2.3.4')).toEqual({ major: 1, minor: 2, patch: 3, build: 4 });
  });

  it.each(['1.2', '1.2.3.4.5', '1.2.x', 'v1.2.3', '1..3', '', '1.-2.3'])(
    'returns undefined for the invalid version %p',
    (raw) => {
      expect(tryParseVersion(raw)).toBeUndefined();
    },
  );
});

describe('formatVersion', () => {
  it('round-trips with and without a build', () => {
    expect(formatVersion(version(1, 2, 3))).toBe('1.2.3');
    expect(formatVersion(version(1, 2, 3, 4))).toBe('1.2.3.4');
  });
});

describe('compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareVersions(version(1, 0, 0), version(2, 0, 0))).toBeLessThan(0);
    expect(compareVersions(version(1, 2, 0), version(1, 1, 9))).toBeGreaterThan(0);
    expect(compareVersions(version(1, 1, 5), version(1, 1, 6))).toBeLessThan(0);
  });

  it('treats equal versions as equal', () => {
    expect(compareVersions(version(1, 2, 3), version(1, 2, 3))).toBe(0);
    expect(compareVersions(version(1, 2, 3, 4), version(1, 2, 3, 4))).toBe(0);
  });

  it('treats a missing build as lesser than any concrete build', () => {
    expect(compareVersions(version(1, 2, 3), version(1, 2, 3, 0))).toBeLessThan(0);
    expect(compareVersions(version(1, 2, 3, 0), version(1, 2, 3))).toBeGreaterThan(0);
  });

  it('orders concrete builds numerically', () => {
    expect(compareVersions(version(1, 2, 3, 2), version(1, 2, 3, 10))).toBeLessThan(0);
  });
});
