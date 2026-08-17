/**
 * Tier 1 — the native Bugsee gateway with the optional SDK **absent** (the
 * default template state). It must report unavailable and no-op safely.
 */
import { NativeBugseeGateway } from '../../../src/access/crashReporting/NativeBugseeGateway';

describe('NativeBugseeGateway (SDK not installed)', () => {
  it('reports unavailable and no-ops without throwing', async () => {
    const gateway = new NativeBugseeGateway();

    expect(gateway.isAvailable).toBe(false);
    await expect(gateway.launch('token')).resolves.toBeUndefined();
    expect(() => gateway.logException(new Error('x'))).not.toThrow();
    expect(() => gateway.event('evt')).not.toThrow();
    expect(() => gateway.setAttribute('k', 'v')).not.toThrow();
  });
});
