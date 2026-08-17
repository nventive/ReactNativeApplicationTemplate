/**
 * Tier 1 — the Firebase-backed remote-config provider, driven through a
 * fake {@link RemoteConfigGateway} so no native module is needed. Covers: safe
 * defaults before/without a fetch, fetch → typed values, real-time updates,
 * fail-soft parsing, and the SDK-absent path.
 */
import { firstValueFrom } from 'rxjs';

import { FirebaseRemoteConfigProvider } from '../../../src/access/remoteConfig/FirebaseRemoteConfigProvider';
import {
  REMOTE_CONFIG_DEFAULTS,
  REMOTE_CONFIG_KEYS,
} from '../../../src/access/remoteConfig/RemoteConfig';
import type {
  RemoteConfigGateway,
  RemoteConfigGatewayOptions,
} from '../../../src/access/remoteConfig/RemoteConfigGateway';
import { formatVersion, version } from '../../../src/access/version/Version';
import { MockLogger } from '../../../src/access/logger/MockLogger';

/** Controllable in-memory {@link RemoteConfigGateway} for the provider tests. */
class FakeRemoteConfigGateway implements RemoteConfigGateway {
  isAvailable = true;
  configured = false;
  fetchCount = 0;
  private values: Record<string, string | boolean> = {};
  private pending: Record<string, string | boolean> = {};
  private listeners: (() => void)[] = [];

  /** Stages remote values that the next `fetchAndActivate` will apply. */
  stageRemote(values: Record<string, string | boolean>): void {
    this.pending = { ...this.pending, ...values };
  }

  /** Simulates a real-time config update that is already activated. */
  pushUpdate(values: Record<string, string | boolean>): void {
    this.values = { ...this.values, ...values };
    this.listeners.forEach((listen) => listen());
  }

  configure(options: RemoteConfigGatewayOptions): Promise<void> {
    this.configured = true;
    for (const [key, value] of Object.entries(options.defaults)) {
      if (!(key in this.values)) this.values[key] = value;
    }
    return Promise.resolve();
  }

  fetchAndActivate(): Promise<void> {
    this.fetchCount += 1;
    this.values = { ...this.values, ...this.pending };
    this.pending = {};
    return Promise.resolve();
  }

  getString(key: string): string | undefined {
    const value = this.values[key];
    return typeof value === 'string' ? value : undefined;
  }

  getBoolean(key: string): boolean | undefined {
    const value = this.values[key];
    return typeof value === 'boolean' ? value : undefined;
  }

  onConfigUpdated(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

/** Lets the provider's fire-and-forget async `initialize()` settle. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('FirebaseRemoteConfigProvider', () => {
  it('serves safe defaults synchronously, before any fetch resolves', () => {
    const provider = new FirebaseRemoteConfigProvider(
      new FakeRemoteConfigGateway(),
      new MockLogger(),
      1,
    );

    expect(provider.getValues()).toEqual(REMOTE_CONFIG_DEFAULTS);
  });

  it('applies defaults + fetches the remote values on init', async () => {
    const gateway = new FakeRemoteConfigGateway();
    gateway.stageRemote({
      [REMOTE_CONFIG_KEYS.minimumVersion]: '2.1.0',
      [REMOTE_CONFIG_KEYS.killSwitchActive]: true,
    });
    const provider = new FirebaseRemoteConfigProvider(gateway, new MockLogger(), 5);

    await flush();

    expect(gateway.configured).toBe(true);
    expect(gateway.fetchCount).toBeGreaterThan(0);
    const values = provider.getValues();
    expect(formatVersion(values.minimumVersion)).toBe('2.1.0');
    expect(values.killSwitchActive).toBe(true);
  });

  it('re-reads and emits on a real-time config update', async () => {
    const gateway = new FakeRemoteConfigGateway();
    const provider = new FirebaseRemoteConfigProvider(gateway, new MockLogger(), 1);
    await flush();

    gateway.pushUpdate({ [REMOTE_CONFIG_KEYS.killSwitchActive]: true });
    await flush();

    const emitted = await firstValueFrom(provider.values$);
    expect(emitted.killSwitchActive).toBe(true);
  });

  it('fails soft: a malformed minimum version falls back to the default', async () => {
    const gateway = new FakeRemoteConfigGateway();
    gateway.stageRemote({ [REMOTE_CONFIG_KEYS.minimumVersion]: 'not-a-version' });
    const provider = new FirebaseRemoteConfigProvider(gateway, new MockLogger(), 1);

    await flush();

    expect(provider.getValues().minimumVersion).toEqual(REMOTE_CONFIG_DEFAULTS.minimumVersion);
  });

  it('reflects an explicit newer minimum through the forced-update contract', async () => {
    const gateway = new FakeRemoteConfigGateway();
    gateway.stageRemote({ [REMOTE_CONFIG_KEYS.minimumVersion]: '3.0.0' });
    const provider = new FirebaseRemoteConfigProvider(gateway, new MockLogger(), 1);

    await flush();
    await provider.refresh();

    expect(provider.getValues().minimumVersion).toEqual(version(3, 0, 0));
  });

  it('serves defaults and never fetches when the SDK is unavailable', async () => {
    const gateway = new FakeRemoteConfigGateway();
    gateway.isAvailable = false;
    const logger = new MockLogger();
    const provider = new FirebaseRemoteConfigProvider(gateway, logger, 1);

    await flush();
    await provider.refresh();

    expect(gateway.fetchCount).toBe(0);
    expect(provider.getValues()).toEqual(REMOTE_CONFIG_DEFAULTS);
    expect(logger.entriesOf('info').some((e) => e.message.includes('unavailable'))).toBe(true);
  });
});
