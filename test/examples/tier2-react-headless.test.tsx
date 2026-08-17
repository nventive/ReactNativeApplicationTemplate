/**
 * Tier 2 example — React runtime, headless (no device, no native UI).
 *
 * Proves both Tier 2 tools: RTL `render` for
 * components and `renderHook` for hooks. Feature hooks (`useJokes`, …) will be
 * tested exactly like the hook below.
 */
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { useCallback, useState } from 'react';

import App, { queryClient } from '../../src/app/App';

// Booting the whole app shell caches a query; drop it so its
// garbage-collection timer doesn't hold the Jest process open.
afterEach(() => queryClient.clear());

function useCounter(initialCount = 0) {
  const [count, setCount] = useState(initialCount);
  const increment = useCallback(() => setCount((current) => current + 1), []);
  return { count, increment };
}

describe('Tier 2 — React headless', () => {
  // Generous timeout: booting the whole app shell pays the one-time cost of
  // RN's lazy inline requires during the first render, which on a cold Babel
  // cache (CI, first local run) can exceed Jest's 5 s default.
  it('renders the app shell and shows mock jokes fetched through all three layers', async () => {
    await render(<App />);

    // "Dad Jokes" now appears in the navigation shell (tab label / header), so
    // assert at least one occurrence rather than a unique node.
    expect(screen.getAllByText('Dad Jokes').length).toBeGreaterThan(0);
    // The Favorites tab proves the bottom-tab shell is present.
    expect(screen.getByText('Favorites')).toBeOnTheScreen();
    // The walking-skeleton slice end to end: screen → hook →
    // business service → mock repository, headless.
    expect(
      await screen.findByText(
        'My wife just completed a 40 week body building program this morning',
      ),
    ).toBeOnTheScreen();
  }, 30000);

  it('drives a hook with renderHook', async () => {
    const { result } = await renderHook(() => useCounter());

    await act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
