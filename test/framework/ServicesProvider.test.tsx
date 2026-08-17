/**
 * Tier 2 — React runtime, headless. Proves that `useServices()`
 * throws a clear error outside the provider, and a `renderHook` test can wrap
 * the provider around a graph built with a fake.
 */
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Joke } from '../../src/access/jokes/Joke';
import type { JokesRepository } from '../../src/access/jokes/JokesRepository';
import { createServices } from '../../src/framework/composition/createServices';
import { ServicesProvider, useServices } from '../../src/framework/composition/ServicesProvider';

class FakeJokesRepository implements JokesRepository {
  getJokes(): Promise<Joke[]> {
    return Promise.resolve([]);
  }
}

describe('ServicesProvider / useServices', () => {
  it('throws a clear error when used outside the provider', async () => {
    // React logs the render error before rethrowing — keep the output clean.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(renderHook(() => useServices())).rejects.toThrow(
      'useServices() must be used within a <ServicesProvider>',
    );

    consoleError.mockRestore();
  });

  it('returns the provided graph inside the provider', async () => {
    const services = createServices({ jokesRepository: new FakeJokesRepository() });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServicesProvider services={services}>{children}</ServicesProvider>
    );

    const { result } = await renderHook(() => useServices(), { wrapper });

    expect(result.current).toBe(services);
  });
});
