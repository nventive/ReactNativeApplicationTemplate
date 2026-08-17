/**
 * Tier 1 example — plain TypeScript running in Node, zero React.
 *
 * This is the fastest tier and the preferred home for Access/Business logic
 * tests. It exists to prove the harness; real Tier 1 tests live alongside
 * the services they cover.
 */
function formatGreeting(name: string): string {
  return `Hello, ${name}!`;
}

describe('Tier 1 — plain TS', () => {
  it('runs a plain function test without any React runtime', () => {
    expect(formatGreeting('world')).toBe('Hello, world!');
  });
});
