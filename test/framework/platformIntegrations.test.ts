/**
 * Tier 1 — the opt-in platform-integration seam. Covers that the overrides are a
 * no-op in the default template (neither optional SDK installed) and that the
 * Firebase native/JS wiring guard warns on a mismatch and stays silent when the
 * two switches agree. No native module is needed — the optional SDKs are not
 * dependencies, so their guarded requires fail in Node and report unavailable.
 */
import { LOG_CATEGORY_KEY } from '../../src/access/logger/LogCategory';
import { MockLogger } from '../../src/access/logger/MockLogger';
import {
  checkPlatformIntegrationConsistency,
  isBugseeAvailable,
  isFirebaseRemoteConfigAvailable,
  platformIntegrationOverrides,
} from '../../src/framework/composition/platformIntegrations';

describe('platformIntegrationOverrides', () => {
  it('returns empty overrides when neither optional SDK is installed (the default template)', () => {
    // The optional SDKs are not dependencies, so their guarded requires fail in
    // Node — availability is false and the overrides collapse to {}, making
    // `createServices(platformIntegrationOverrides())` identical to `createServices()`.
    expect(isFirebaseRemoteConfigAvailable()).toBe(false);
    expect(isBugseeAvailable()).toBe(false);
    expect(platformIntegrationOverrides()).toEqual({});
  });
});

describe('checkPlatformIntegrationConsistency', () => {
  it('warns when Firebase is enabled natively but the JS SDK is missing', () => {
    const logger = new MockLogger();

    checkPlatformIntegrationConsistency({
      firebaseEnabledNatively: true,
      firebaseSdkAvailable: false,
      logger,
    });

    const errors = logger.entriesOf('error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('FIREBASE_ENABLED=true');
  });

  it('warns when the JS SDK is wired but Firebase is not enabled natively', () => {
    const logger = new MockLogger();

    checkPlatformIntegrationConsistency({
      firebaseEnabledNatively: false,
      firebaseSdkAvailable: true,
      logger,
    });

    const errors = logger.entriesOf('error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('not enabled natively');
  });

  it('stays silent when both switches agree (both off, or both on)', () => {
    const bothOff = new MockLogger();
    checkPlatformIntegrationConsistency({
      firebaseEnabledNatively: false,
      firebaseSdkAvailable: false,
      logger: bothOff,
    });

    const bothOn = new MockLogger();
    checkPlatformIntegrationConsistency({
      firebaseEnabledNatively: true,
      firebaseSdkAvailable: true,
      logger: bothOn,
    });

    expect(bothOff.entriesOf('error')).toHaveLength(0);
    expect(bothOn.entriesOf('error')).toHaveLength(0);
  });

  it('tags the warning with the platformIntegration log category so the console can filter it', () => {
    const logger = new MockLogger();

    checkPlatformIntegrationConsistency({
      firebaseEnabledNatively: true,
      firebaseSdkAvailable: false,
      logger,
    });

    expect(logger.entriesOf('error')[0].meta?.[LOG_CATEGORY_KEY]).toBe('platformIntegration');
  });
});
