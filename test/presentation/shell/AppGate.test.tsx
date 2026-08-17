/**
 * Tier 2 — React runtime, headless. Drives the operational blocking gate through
 * the REAL graph, toggling the mock remote-config controller and asserting which
 * screen the gate shows: app content, forced update, or kill switch (with forced
 * update taking precedence). Observable toggles are wrapped in `act` so the UI
 * flushes (see the useObservable/fireEvent convention).
 */
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../../../src/framework/i18n';
import { MockCurrentVersionRepository } from '../../../src/access/appInfo/MockCurrentVersionRepository';
import type { RemoteConfigController } from '../../../src/access/remoteConfig/RemoteConfigProvider';
import { version } from '../../../src/access/version/Version';
import { createServices } from '../../../src/framework/composition/createServices';
import { ServicesProvider } from '../../../src/framework/composition/ServicesProvider';
import { AppGate } from '../../../src/presentation/shell/AppGate';
import { ThemeProvider } from '../../../src/presentation/theme';

async function renderGate() {
  const services = createServices({
    currentVersionRepository: new MockCurrentVersionRepository(version(1, 0, 0)),
  });
  const controller = services.remoteConfigController as RemoteConfigController;
  await render(
    <SafeAreaProvider>
      <ThemeProvider>
        <ServicesProvider services={services}>
          <AppGate>
            <Text>APP CONTENT</Text>
          </AppGate>
        </ServicesProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  // Let the async installed-version read resolve so the gate settles to "open".
  await act(async () => {});
  return { controller };
}

async function drive(controller: RemoteConfigController, mutate: () => void) {
  await act(async () => {
    mutate();
  });
}

describe('AppGate', () => {
  it('shows the app when no operational block is active', async () => {
    await renderGate();
    expect(screen.getByText('APP CONTENT')).toBeOnTheScreen();
    expect(screen.queryByTestId('ForcedUpdateScreen')).toBeNull();
    expect(screen.queryByTestId('KillSwitchScreen')).toBeNull();
  });

  it('blocks with the forced-update screen when an update is required', async () => {
    const { controller } = await renderGate();

    await drive(controller, () => controller.setMinimumVersion(version(999, 0, 0)));

    expect(screen.getByTestId('ForcedUpdateScreen')).toBeOnTheScreen();
    expect(screen.queryByText('APP CONTENT')).toBeNull();
  });

  it('blocks with the kill-switch screen when the kill switch is active', async () => {
    const { controller } = await renderGate();

    await drive(controller, () => controller.setKillSwitchActive(true));

    expect(screen.getByTestId('KillSwitchScreen')).toBeOnTheScreen();
    expect(screen.queryByText('APP CONTENT')).toBeNull();
  });

  it('gives forced update precedence over the kill switch', async () => {
    const { controller } = await renderGate();

    await drive(controller, () => {
      controller.setKillSwitchActive(true);
      controller.setMinimumVersion(version(999, 0, 0));
    });

    expect(screen.getByTestId('ForcedUpdateScreen')).toBeOnTheScreen();
    expect(screen.queryByTestId('KillSwitchScreen')).toBeNull();
  });

  it('recovers to the app when the kill switch lifts', async () => {
    const { controller } = await renderGate();

    await drive(controller, () => controller.setKillSwitchActive(true));
    expect(screen.getByTestId('KillSwitchScreen')).toBeOnTheScreen();

    await drive(controller, () => controller.setKillSwitchActive(false));
    expect(screen.getByText('APP CONTENT')).toBeOnTheScreen();
  });
});
