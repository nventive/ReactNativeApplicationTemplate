/**
 * Tier 1 — the explicit start step. Proves it owns the runtime side effects that
 * used to live in the constructor / mid-wiring (finding #17): it launches the
 * startable opt-in services and tags the crash reporter with the environment,
 * while leaving the default no-op / mock / static implementations untouched.
 */
import { RecordingCrashReporter } from '../../src/access/crashReporting/RecordingCrashReporter';
import { MockLogger } from '../../src/access/logger/MockLogger';
import { StaticRemoteConfigProvider } from '../../src/access/remoteConfig/StaticRemoteConfigProvider';
import { createServices } from '../../src/framework/composition/createServices';
import { startServices } from '../../src/framework/composition/startServices';

/** A crash reporter with an explicit launch step, to observe the start call. */
class StartableCrashReporter extends RecordingCrashReporter {
  started = 0;

  start(): void {
    this.started += 1;
  }
}

/** A remote-config provider with an explicit start step, to observe the start call. */
class StartableRemoteConfigProvider extends StaticRemoteConfigProvider {
  started = 0;

  start(): void {
    this.started += 1;
  }
}

describe('startServices', () => {
  it('launches startable services and tags the environment on the crash reporter', () => {
    const crashReporter = new StartableCrashReporter();
    const remoteConfig = new StartableRemoteConfigProvider();
    const services = createServices({ crashReporter, remoteConfig });

    startServices(services);

    expect(crashReporter.started).toBe(1);
    expect(remoteConfig.started).toBe(1);
    expect(crashReporter.recordsOf('attribute')).toContainEqual(
      expect.objectContaining({
        key: 'environment',
        value: services.environment.getCurrent(),
      }),
    );
  });

  it('skips the non-startable default implementations without throwing', () => {
    // The default graph's crash reporter (no-op) and remote config (mock) have no
    // start() — startServices must skip them, not crash.
    const services = createServices();

    expect(() => startServices(services)).not.toThrow();
  });

  it('logs no wiring mismatch in the default template (no native Firebase, no JS SDK)', () => {
    const logger = new MockLogger();
    const services = createServices({ logger });

    startServices(services);

    expect(logger.entriesOf('error')).toHaveLength(0);
  });
});
