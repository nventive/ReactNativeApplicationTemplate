/**
 * Tier 2 — React runtime, headless. Drives the diagnostics overlay through the
 * REAL graph (development => diagnostics enabled, mocking on): open the panel,
 * exercise the environment picker, the mocking + logging toggles, the mock
 * remote-config triggers, the dedicated log-console / network-inspector pages
 * (the overlay's own navigation), and the dismissal. Interactions that flip
 * observables are wrapped in `act` (the useObservable/fireEvent convention).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../../../src/framework/i18n';
import { MockAppInfoRepository } from '../../../src/access/appInfo/MockAppInfoRepository';
import { InMemoryNetworkInspector } from '../../../src/access/http/NetworkInspector';
import { InMemoryFileSystemGateway } from '../../../src/access/logger/FileSystemGateway';
import { MockFileSharer } from '../../../src/access/native/MockFileSharer';
import {
  createServices,
  type ServiceOverrides,
  type Services,
} from '../../../src/framework/composition/createServices';
import { ServicesProvider } from '../../../src/framework/composition/ServicesProvider';
import { DiagnosticsHost } from '../../../src/presentation/diagnostics/DiagnosticsHost';
import { ThemeProvider } from '../../../src/presentation/theme';

async function renderHost(overrides: ServiceOverrides = {}): Promise<{ services: Services }> {
  const services = createServices(overrides);
  await render(
    <SafeAreaProvider>
      <ThemeProvider>
        <ServicesProvider services={services}>
          <DiagnosticsHost>
            <Text>APP</Text>
          </DiagnosticsHost>
        </ServicesProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {});
  return { services };
}

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

async function openPanel() {
  await press('DiagnosticsLauncher');
}

describe('Diagnostics overlay', () => {
  it('shows the launcher and opens the panel', async () => {
    await renderHost();
    expect(screen.getByTestId('DiagnosticsLauncher')).toBeOnTheScreen();

    await openPanel();

    expect(screen.getByTestId('DiagnosticsPanel')).toBeOnTheScreen();
  });

  it('shows the app name, version, native build number, bundle id and device info', async () => {
    await renderHost({
      appInfo: new MockAppInfoRepository({
        name: 'Acme App',
        version: '2.3.4',
        buildNumber: '42',
        bundleId: 'com.acme.app',
        platform: 'android',
        osVersion: '14 (API 34)',
      }),
    });
    await openPanel();

    expect(screen.getByText('Name: Acme App')).toBeOnTheScreen();
    expect(screen.getByText('Version: 2.3.4 (42)')).toBeOnTheScreen();
    expect(screen.getByText('Bundle ID: com.acme.app')).toBeOnTheScreen();
    expect(screen.getByText('Platform: android')).toBeOnTheScreen();
    expect(screen.getByText('OS version: 14 (API 34)')).toBeOnTheScreen();
  });

  it('exposes the theme switcher in the panel', async () => {
    await renderHost();
    await openPanel();

    expect(screen.getByTestId('DiagnosticsTheme-system')).toBeOnTheScreen();
    expect(screen.getByTestId('DiagnosticsTheme-light')).toBeOnTheScreen();
    expect(screen.getByTestId('DiagnosticsTheme-dark')).toBeOnTheScreen();
  });

  it('persists an environment override and shows the restart banner', async () => {
    const { services } = await renderHost();
    await openPanel();

    await press('DiagnosticsEnv-staging');

    expect(screen.getByTestId('DiagnosticsEnvPending')).toBeOnTheScreen();
    expect(services.environment.getCurrent()).toBe('development'); // applied on restart
  });

  it('toggles the mocking flag and shows the restart banner', async () => {
    const { services } = await renderHost();
    await openPanel();

    await act(async () => {
      fireEvent(screen.getByTestId('DiagnosticsMockingSwitch'), 'valueChange', false);
    });

    expect(screen.getByTestId('DiagnosticsMockingPending')).toBeOnTheScreen();
    expect(services.mocking.isEnabled()).toBe(false);
  });

  it('toggles console logging and shows the restart banner', async () => {
    const { services } = await renderHost();
    await openPanel();

    await act(async () => {
      fireEvent(screen.getByTestId('DiagnosticsConsoleLoggingSwitch'), 'valueChange', false);
    });

    expect(screen.getByTestId('DiagnosticsLoggingPending')).toBeOnTheScreen();
    expect(services.logging.getConsoleEnabled()).toBe(false); // persisted; applied on restart
  });

  it('captures generated logs on the dedicated log console page and filters by network', async () => {
    await renderHost({ fileSystem: new InMemoryFileSystemGateway() });
    await openPanel();

    await press('DiagnosticsGenerateLogs'); // writes debug/info/warn/error through the logger
    await press('DiagnosticsOpenLogConsole'); // navigate to the dedicated page

    expect(screen.getByTestId('DiagnosticsLogConsoleScreen')).toBeOnTheScreen();
    expect(screen.getByText('Diagnostics test log · warn')).toBeOnTheScreen();

    // The generated logs are not HTTP events, so the Network filter shows nothing.
    await press('DiagnosticsLogFilter-network');
    expect(screen.getByTestId('DiagnosticsLogConsoleEmpty')).toBeOnTheScreen();

    // Back returns to the panel.
    await press('DiagnosticsBack');
    expect(screen.getByTestId('DiagnosticsPanel')).toBeOnTheScreen();
  });

  it('opens the network inspector page and drills into a captured request', async () => {
    const inspector = new InMemoryNetworkInspector();
    const id = inspector.begin({
      method: 'GET',
      url: '/jokes/top.json',
      headers: { accept: 'application/json' },
    });
    inspector.complete(id, {
      status: 200,
      headers: { 'content-type': 'application/json' },
      responseBody: '{"ok":true}',
    });

    await renderHost({ networkInspector: inspector });
    await openPanel();
    await press('DiagnosticsOpenNetwork');

    expect(screen.getByTestId('DiagnosticsNetworkList')).toBeOnTheScreen();
    expect(screen.getByText('/jokes/top.json')).toBeOnTheScreen();

    await press(`DiagnosticsNetworkRow-${id}`);

    expect(screen.getByTestId('DiagnosticsNetworkDetail')).toBeOnTheScreen();
    expect(screen.getByText('content-type')).toBeOnTheScreen(); // a response header key
    expect(screen.getByText(/"ok": true/)).toBeOnTheScreen(); // pretty-printed body
  });

  it('shows the network inspector empty state when nothing was captured', async () => {
    await renderHost();
    await openPanel();

    await press('DiagnosticsOpenNetwork');

    expect(screen.getByTestId('DiagnosticsNetworkEmpty')).toBeOnTheScreen();
  });

  it('drives the kill switch from the mock remote-config trigger', async () => {
    const { services } = await renderHost();
    await openPanel();

    await press('DiagnosticsToggleKillSwitch');

    expect(services.remoteConfig.getValues().killSwitchActive).toBe(true);
  });

  it('hides the whole overlay when dismissed for the session', async () => {
    await renderHost();
    await openPanel();

    await press('DiagnosticsDismiss');

    expect(screen.queryByTestId('DiagnosticsPanel')).toBeNull();
    expect(screen.queryByTestId('DiagnosticsLauncher')).toBeNull();
  });

  it('shares the actual log FILE (its URI), not the log text', async () => {
    const fileSharer = new MockFileSharer();
    await renderHost({ fileSystem: new InMemoryFileSystemGateway(), fileSharer });
    await openPanel();

    await press('DiagnosticsGenerateLogs'); // writes entries to the log file
    await press('DiagnosticsShareLogs');
    await act(async () => {});

    expect(fileSharer.shared).toHaveLength(1);
    const [shared] = fileSharer.shared;
    // A real file:// URI ending in .log — not the log contents.
    expect(shared.uri).toBe('file:///memory/application.log');
    expect(shared.uri.endsWith('.log')).toBe(true);
    expect(shared.options?.mimeType).toBe('text/plain');
  });
});
