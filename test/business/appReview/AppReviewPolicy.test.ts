/**
 * Tier 1 — plain TS. The app-review rule is a pure function, so it is tested in
 * isolation from the service plumbing (counting, persistence, the gateway).
 */
import {
  DEFAULT_SIGNAL_THRESHOLD,
  createDefaultAppReviewPolicy,
} from '../../../src/business/appReview/AppReviewPolicy';

describe('createDefaultAppReviewPolicy', () => {
  const policy = createDefaultAppReviewPolicy();

  it('skips below the signal threshold', () => {
    const decision = policy({
      signalCount: DEFAULT_SIGNAL_THRESHOLD - 1,
      currentVersion: '1.0.0',
      lastPromptedVersion: undefined,
    });

    expect(decision.outcome).toBe('skip');
  });

  it('prompts at the threshold when the version was never prompted', () => {
    const decision = policy({
      signalCount: DEFAULT_SIGNAL_THRESHOLD,
      currentVersion: '1.0.0',
      lastPromptedVersion: undefined,
    });

    expect(decision).toEqual({ outcome: 'prompt' });
  });

  it('skips once the current version has already been prompted', () => {
    const decision = policy({
      signalCount: DEFAULT_SIGNAL_THRESHOLD + 10,
      currentVersion: '1.0.0',
      lastPromptedVersion: '1.0.0',
    });

    expect(decision.outcome).toBe('skip');
  });

  it('prompts again after a version bump past the threshold', () => {
    const decision = policy({
      signalCount: DEFAULT_SIGNAL_THRESHOLD,
      currentVersion: '1.1.0',
      lastPromptedVersion: '1.0.0',
    });

    expect(decision).toEqual({ outcome: 'prompt' });
  });

  it('respects a custom threshold', () => {
    const strict = createDefaultAppReviewPolicy(5);

    expect(
      strict({ signalCount: 4, currentVersion: '1.0.0', lastPromptedVersion: undefined }),
    ).toHaveProperty('outcome', 'skip');
    expect(
      strict({ signalCount: 5, currentVersion: '1.0.0', lastPromptedVersion: undefined }),
    ).toEqual({ outcome: 'prompt' });
  });
});
