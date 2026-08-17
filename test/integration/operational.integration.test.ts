/**
 * Headless integration test — "boot the graph, fake the edges, drive through
 * services". Exercises the operational flows end to
 * end through the REAL composition root: forced update + kill switch (driven via
 * the mock remote-config edge), and the two restart-to-apply switches
 * (environment + mocking toggle), driven through a shared persisted store across
 * two graph builds — the "restart" a runtime switch needs to take effect.
 * No device, no UI, no React.
 */
import { InMemoryKeyValueStore } from '../../src/access/storage/InMemoryKeyValueStore';
import { MockCurrentVersionRepository } from '../../src/access/appInfo/MockCurrentVersionRepository';
import { version } from '../../src/access/version/Version';
import { ENVIRONMENTS, type Environment } from '../../src/business/environment/EnvironmentService';
import { createServices } from '../../src/framework/composition/createServices';

/** Flush the microtask queue so the async installed-version read resolves. */
const flush = () => Promise.resolve();

describe('Operational features (headless integration)', () => {
  it('drives forced update from the mock remote config through the real graph', async () => {
    const services = createServices({
      currentVersionRepository: new MockCurrentVersionRepository(version(1, 0, 0)),
    });
    const controller = services.remoteConfigController;
    expect(controller).not.toBeNull();

    const emitted: boolean[] = [];
    const sub = services.forcedUpdate.isUpdateRequired$.subscribe((v) => emitted.push(v));
    await flush();

    controller!.setMinimumVersion(version(2, 0, 0)); // raise the bar → blocks
    controller!.setMinimumVersion(version(1, 0, 0)); // lower it again → lifts
    await flush();

    expect(emitted[0]).toBe(false);
    expect(emitted).toContain(true);
    expect(emitted.at(-1)).toBe(false);
    sub.unsubscribe();
  });

  it('drives the kill switch from the mock remote config through the real graph', async () => {
    const services = createServices();
    const controller = services.remoteConfigController;
    expect(controller).not.toBeNull();

    const emitted: boolean[] = [];
    const sub = services.killSwitch.isKillSwitchActive$.subscribe((v) => emitted.push(v));

    controller!.setKillSwitchActive(true);
    controller!.toggleKillSwitch(); // back off — in-session recovery

    expect(emitted).toEqual([false, true, false]);
    sub.unsubscribe();
  });

  it('applies an environment switch on the next launch (persist now, apply on restart)', async () => {
    // A shared store is the persistence the switch survives a restart through;
    // mocking is forced on so both graphs stay fully offline regardless of env.
    const store = new InMemoryKeyValueStore();
    const first = createServices({ keyValueStore: store, mockingEnabled: true });

    const startEnv = first.environment.getCurrent();
    const target: Environment = ENVIRONMENTS.find((env) => env !== startEnv)!;

    const pending: (Environment | null)[] = [];
    const sub = first.environment.pending$.subscribe((v) => pending.push(v));

    await first.environment.setEnvironment(target);

    // The active environment does NOT change mid-session — only the banner does.
    expect(first.environment.getCurrent()).toBe(startEnv);
    expect(pending.at(-1)).toBe(target);
    sub.unsubscribe();

    // "Restart": a fresh graph over the same store reads the persisted override.
    const relaunched = createServices({ keyValueStore: store, mockingEnabled: true });
    expect(relaunched.environment.getCurrent()).toBe(target);
  });

  it('applies a mocking-toggle change on the next launch and re-wires the data sources', () => {
    const store = new InMemoryKeyValueStore();
    const first = createServices({ keyValueStore: store });

    const startup = first.mocking.isEnabled();
    // The mock provider (and its controls) is wired only when mocking is on.
    expect(first.remoteConfigController !== null).toBe(startup);

    const pending: boolean[] = [];
    const sub = first.mocking.hasPendingChange$.subscribe((v) => pending.push(v));

    first.mocking.toggle();

    expect(first.mocking.isEnabled()).toBe(!startup);
    expect(pending.at(-1)).toBe(true); // "restart to apply" banner is raised
    sub.unsubscribe();

    // "Restart": the fresh graph reads the persisted flag and swaps the data
    // sources with it — the remote-config controller presence follows the flag.
    const relaunched = createServices({ keyValueStore: store });
    expect(relaunched.mocking.isEnabled()).toBe(!startup);
    expect(relaunched.remoteConfigController !== null).toBe(!startup);
  });

  it('applies a logging-transport toggle on the next launch (persist now, apply on restart)', () => {
    // Build default is development: file logging on, diagnostics on (so the
    // in-app console buffer exists). Mocking forced on to stay offline.
    const store = new InMemoryKeyValueStore();
    const first = createServices({ keyValueStore: store, mockingEnabled: true });

    expect(first.logReader).not.toBeNull(); // file transport wired → file viewer
    expect(first.logBuffer).not.toBeNull(); // diagnostics on → in-app console buffer

    const pending: boolean[] = [];
    const sub = first.logging.hasPendingChange$.subscribe((v) => pending.push(v));

    first.logging.setFileEnabled(false);

    // The running logger keeps its transports mid-session — only the banner flips.
    expect(first.logReader).not.toBeNull();
    expect(pending.at(-1)).toBe(true);
    sub.unsubscribe();

    // "Restart": a fresh graph over the same store drops the file transport, but
    // the in-app console buffer is independent of the file/console toggles.
    const relaunched = createServices({ keyValueStore: store, mockingEnabled: true });
    expect(relaunched.logReader).toBeNull();
    expect(relaunched.logBuffer).not.toBeNull();
  });
});
