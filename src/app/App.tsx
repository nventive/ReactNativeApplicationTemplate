import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Side-effect import: initializes i18next before the first render.
import '../framework/i18n';
import { createServices } from '../framework/composition/createServices';
import { ServicesProvider } from '../framework/composition/ServicesProvider';
import { DiagnosticsHost } from '../presentation/diagnostics/DiagnosticsHost';
import { NavigationRoot } from '../presentation/navigation/NavigationRoot';
import { ThemeProvider } from '../presentation/theme';
import { AppGate } from '../presentation/shell/AppGate';
import { ConnectedErrorBoundary } from '../presentation/shell/ConnectedErrorBoundary';

// Composition happens once, at module load: the production service graph and the
// React Query client are plain objects with no React lifecycle of their own.
// Tests build their own graph with fakes via `createServices({ ...overrides })`;
// the query client is exported so non-React code (and the app-shell test) can
// reach the cache.
const services = createServices();
export const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>
            {/* Error boundary just inside the providers so it can log via the
                composition root's Logger. The diagnostics overlay wraps the gate
                (so it stays reachable during a forced-update / kill-switch
                block); the gate wraps the app (so those blocks replace it). */}
            <ConnectedErrorBoundary>
              <DiagnosticsHost>
                <AppGate>
                  <NavigationRoot />
                </AppGate>
              </DiagnosticsHost>
            </ConnectedErrorBoundary>
            <StatusBar style="auto" />
          </QueryClientProvider>
        </ServicesProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
