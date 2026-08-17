/**
 * Tier 1 — plain TS, no React. Exercises the app-review policy against the
 * in-memory gateway + store, so the once-per-version and signal-threshold rules
 * are proven headlessly (the native prompt never fires here).
 */
import { InMemoryAppReviewGateway } from '../../../src/access/appReview/InMemoryAppReviewGateway';
import type { CurrentVersionRepository } from '../../../src/access/appInfo/CurrentVersionRepository';
import { MockLogger } from '../../../src/access/logger/MockLogger';
import { InMemoryKeyValueStore } from '../../../src/access/storage/InMemoryKeyValueStore';
import type { KeyValueStore } from '../../../src/access/storage/KeyValueStore';
import { version, type Version } from '../../../src/access/version/Version';
import {
  DEFAULT_SIGNAL_THRESHOLD,
  DefaultAppReviewService,
} from '../../../src/business/appReview/DefaultAppReviewService';

class FixedVersionRepository implements CurrentVersionRepository {
  constructor(private current: Version) {}
  setVersion(next: Version) {
    this.current = next;
  }
  getCurrentVersion(): Promise<Version> {
    return Promise.resolve(this.current);
  }
}

function makeService(options?: {
  store?: KeyValueStore;
  gateway?: InMemoryAppReviewGateway;
  versionRepo?: FixedVersionRepository;
}) {
  const store = options?.store ?? new InMemoryKeyValueStore();
  const gateway = options?.gateway ?? new InMemoryAppReviewGateway();
  const versionRepo = options?.versionRepo ?? new FixedVersionRepository(version(1, 0, 0));
  const logger = new MockLogger();
  const service = new DefaultAppReviewService(gateway, store, versionRepo, logger);
  return { service, store, gateway, versionRepo, logger };
}

/** Calls the service `n` times and returns how many actually prompted. */
async function requestTimes(service: DefaultAppReviewService, n: number): Promise<number> {
  let prompts = 0;
  for (let i = 0; i < n; i += 1) {
    if (await service.requestReviewIfAppropriate()) prompts += 1;
  }
  return prompts;
}

describe('DefaultAppReviewService', () => {
  it('does not prompt before the signal threshold is reached', async () => {
    const { service, gateway } = makeService();

    const prompts = await requestTimes(service, DEFAULT_SIGNAL_THRESHOLD - 1);

    expect(prompts).toBe(0);
    expect(gateway.requestedCount).toBe(0);
  });

  it('prompts exactly once when the threshold is reached', async () => {
    const { service, gateway } = makeService();

    const prompts = await requestTimes(service, DEFAULT_SIGNAL_THRESHOLD);

    expect(prompts).toBe(1);
    expect(gateway.requestedCount).toBe(1);
  });

  it('does not prompt again for the same version after prompting once', async () => {
    const { service, gateway } = makeService();

    await requestTimes(service, DEFAULT_SIGNAL_THRESHOLD + 5);

    expect(gateway.requestedCount).toBe(1);
  });

  it('prompts again after the app updates to a new version', async () => {
    const versionRepo = new FixedVersionRepository(version(1, 0, 0));
    const { service, gateway } = makeService({ versionRepo });

    await requestTimes(service, DEFAULT_SIGNAL_THRESHOLD);
    expect(gateway.requestedCount).toBe(1);

    versionRepo.setVersion(version(1, 1, 0));
    await requestTimes(service, DEFAULT_SIGNAL_THRESHOLD);

    expect(gateway.requestedCount).toBe(2);
  });

  it('does not prompt when the platform review flow is unavailable', async () => {
    const gateway = new InMemoryAppReviewGateway(false);
    const { service } = makeService({ gateway });

    const prompts = await requestTimes(service, DEFAULT_SIGNAL_THRESHOLD + 2);

    expect(prompts).toBe(0);
    expect(gateway.requestedCount).toBe(0);
  });

  it('persists state across a simulated restart (new service over the same store)', async () => {
    const store = new InMemoryKeyValueStore();
    const gateway = new InMemoryAppReviewGateway();

    // First "session": one signal short of the threshold.
    const first = makeService({ store, gateway }).service;
    await requestTimes(first, DEFAULT_SIGNAL_THRESHOLD - 1);
    expect(gateway.requestedCount).toBe(0);

    // A fresh service over the same store = an app relaunch: one more signal prompts.
    const second = makeService({ store, gateway }).service;
    const prompted = await second.requestReviewIfAppropriate();

    expect(prompted).toBe(true);
    expect(gateway.requestedCount).toBe(1);
  });

  it('never throws when the gateway fails — the triggering flow is protected', async () => {
    const throwingGateway: InMemoryAppReviewGateway = new InMemoryAppReviewGateway();
    throwingGateway.requestReview = () => Promise.reject(new Error('SDK boom'));
    const { service, logger } = makeService({ gateway: throwingGateway });

    await expect(requestTimes(service, DEFAULT_SIGNAL_THRESHOLD)).resolves.toBe(0);
    expect(logger.entriesOf('warn').length).toBeGreaterThan(0);
  });
});
