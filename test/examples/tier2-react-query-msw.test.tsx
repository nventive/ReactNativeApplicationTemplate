/**
 * Tier 2 example — `useQuery` against an MSW-faked endpoint.
 *
 * This is the pattern for hook-level tests of HTTP-backed data backed by real
 * repositories: MSW owns the network, React Query owns the
 * async state, the test only asserts on hook output.
 *
 * Note: app code takes query keys from the `queryKeys` factory
 * (`src/presentation/queryKeys.ts`) — never ad-hoc arrays. The inline key
 * below is acceptable only because this is a self-contained example test.
 */
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';

const server = setupServer(
  http.get('https://example.test/message', () => HttpResponse.json({ message: 'from msw' })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function useMessage() {
  return useQuery({
    queryKey: ['example', 'message'],
    queryFn: async () => {
      const response = await fetch('https://example.test/message');
      return (await response.json()) as { message: string };
    },
  });
}

function createWrapper() {
  // retry: false → failures surface immediately; gcTime: Infinity → no
  // garbage-collection timers left running after the test (open handles).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('Tier 2 — React Query over MSW', () => {
  it('resolves a useQuery hook from a faked endpoint', async () => {
    const { result } = await renderHook(() => useMessage(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ message: 'from msw' });
  });
});
