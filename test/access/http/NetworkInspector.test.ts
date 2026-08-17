/**
 * Tier 1 — plain TS. Covers the in-memory network inspector store: begin seeds a
 * pending exchange, complete/fail fill it in place (with duration from the
 * injected clock), the ring buffer caps capacity, and clear empties it.
 */
import { InMemoryNetworkInspector } from '../../../src/access/http/NetworkInspector';

/** A controllable clock so durations are deterministic. */
function fakeClock(start = 1000) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('InMemoryNetworkInspector', () => {
  it('records a pending exchange on begin and returns its id', () => {
    const inspector = new InMemoryNetworkInspector();

    const id = inspector.begin({
      method: 'GET',
      url: '/ok',
      headers: { accept: 'application/json' },
    });

    const [exchange] = inspector.getExchanges();
    expect(exchange.id).toBe(id);
    expect(exchange).toMatchObject({ method: 'GET', url: '/ok', state: 'pending' });
    expect(exchange.requestHeaders).toEqual({ accept: 'application/json' });
  });

  it('completes an exchange in place with status, body, and duration', () => {
    const clock = fakeClock();
    const inspector = new InMemoryNetworkInspector(100, clock.now);
    const id = inspector.begin({ method: 'GET', url: '/ok', headers: {} });

    clock.advance(42);
    inspector.complete(id, {
      status: 200,
      headers: { 'content-type': 'application/json' },
      responseBody: '{"v":1}',
    });

    const [exchange] = inspector.getExchanges();
    expect(exchange).toMatchObject({
      state: 'success',
      status: 200,
      responseBody: '{"v":1}',
      durationMs: 42,
    });
    expect(exchange.responseHeaders).toEqual({ 'content-type': 'application/json' });
  });

  it('marks an exchange as failed with its error kind', () => {
    const inspector = new InMemoryNetworkInspector();
    const id = inspector.begin({ method: 'GET', url: '/boom', headers: {} });

    inspector.fail(id, { status: 500, errorKind: 'server' });

    expect(inspector.getExchanges()[0]).toMatchObject({
      state: 'failure',
      status: 500,
      errorKind: 'server',
    });
  });

  it('emits the current exchanges on exchanges$', () => {
    const inspector = new InMemoryNetworkInspector();
    const counts: number[] = [];
    const sub = inspector.exchanges$.subscribe((exchanges) => counts.push(exchanges.length));

    const id = inspector.begin({ method: 'GET', url: '/ok', headers: {} });
    inspector.complete(id, { status: 200, headers: {} });

    expect(counts).toEqual([0, 1, 1]); // initial, begin, complete (in place)
    sub.unsubscribe();
  });

  it('caps at capacity, dropping the oldest exchange', () => {
    const inspector = new InMemoryNetworkInspector(2);

    inspector.begin({ method: 'GET', url: '/1', headers: {} });
    inspector.begin({ method: 'GET', url: '/2', headers: {} });
    inspector.begin({ method: 'GET', url: '/3', headers: {} });

    expect(inspector.getExchanges().map((e) => e.url)).toEqual(['/2', '/3']);
  });

  it('ignores completion for an id that has already been dropped', () => {
    const inspector = new InMemoryNetworkInspector(1);
    const first = inspector.begin({ method: 'GET', url: '/1', headers: {} });
    inspector.begin({ method: 'GET', url: '/2', headers: {} }); // evicts /1

    expect(() => inspector.complete(first, { status: 200, headers: {} })).not.toThrow();
    expect(inspector.getExchanges().map((e) => e.url)).toEqual(['/2']);
  });

  it('clears every exchange', () => {
    const inspector = new InMemoryNetworkInspector();
    inspector.begin({ method: 'GET', url: '/ok', headers: {} });

    inspector.clear();

    expect(inspector.getExchanges()).toEqual([]);
  });
});
