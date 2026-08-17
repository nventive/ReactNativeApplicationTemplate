/**
 * Tier 2 — the diagnostics theme switcher. Proves picking a mode re-themes the
 * tree immediately (no restart), through the real `ThemeProvider` + `useTheme`.
 * The press flips the theme context, so it is wrapped in `act` (the
 * fireEvent/observable-flush convention).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import '../../../src/framework/i18n';
import { ThemeSection } from '../../../src/presentation/diagnostics/ThemeSection';
import { ThemeProvider, useTheme } from '../../../src/presentation/theme';

/** Renders the active theme's polarity so the test can observe a live switch. */
function ThemeProbe() {
  const theme = useTheme();
  return <Text testID="ThemeProbe">{theme.dark ? 'DARK' : 'LIGHT'}</Text>;
}

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

describe('ThemeSection', () => {
  it('re-themes the app immediately when a mode is picked', async () => {
    await render(
      <ThemeProvider initialMode="light">
        <ThemeProbe />
        <ThemeSection />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('ThemeProbe')).toHaveTextContent('LIGHT');

    await press('DiagnosticsTheme-dark');
    expect(screen.getByTestId('ThemeProbe')).toHaveTextContent('DARK');

    await press('DiagnosticsTheme-light');
    expect(screen.getByTestId('ThemeProbe')).toHaveTextContent('LIGHT');
  });

  it('offers system / light / dark options', async () => {
    await render(
      <ThemeProvider>
        <ThemeSection />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('DiagnosticsTheme-system')).toBeOnTheScreen();
    expect(screen.getByTestId('DiagnosticsTheme-light')).toBeOnTheScreen();
    expect(screen.getByTestId('DiagnosticsTheme-dark')).toBeOnTheScreen();
  });
});
