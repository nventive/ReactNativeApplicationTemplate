import { createContext, useContext, type ReactNode } from 'react';

import type { Services } from './createServices';

const ServicesContext = createContext<Services | undefined>(undefined);

/**
 * Exposes the composition root's `Services` graph to the UI boundary.
 *
 * The app shell wraps the tree once with the production graph; tests wrap
 * components/hooks with a graph built from fakes:
 * `<ServicesProvider services={createServices({ jokesRepository: fake })}>`.
 */
export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

/**
 * The single doorway from Presentation to Business — screens and hooks obtain
 * services here and never import implementations directly.
 */
export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (services === undefined) {
    throw new Error(
      'useServices() must be used within a <ServicesProvider>. ' +
        'Wrap your component tree (or test) with a ServicesProvider holding a createServices() graph.',
    );
  }
  return services;
}
