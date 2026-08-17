/**
 * Tier 2 — the design system. Proves the light/dark switch works and
 * that `useTheme` degrades gracefully outside a provider.
 */
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { darkColors, lightColors } from '../../../src/presentation/theme/tokens';
import {
  ThemeProvider,
  useTheme,
  useThemeMode,
} from '../../../src/presentation/theme/ThemeProvider';

function useThemeProbe() {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  return { theme, mode, setMode };
}

describe('theme', () => {
  it('switches between light and dark at runtime', async () => {
    function wrapper({ children }: { children: ReactNode }) {
      return <ThemeProvider initialMode="light">{children}</ThemeProvider>;
    }

    const { result } = await renderHook(() => useThemeProbe(), { wrapper });

    expect(result.current.theme.dark).toBe(false);
    expect(result.current.theme.colors.background).toBe(lightColors.background);

    await act(() => {
      result.current.setMode('dark');
    });

    expect(result.current.theme.dark).toBe(true);
    expect(result.current.theme.colors.background).toBe(darkColors.background);
  });

  it('falls back to the light theme outside a ThemeProvider', async () => {
    const { result } = await renderHook(() => useTheme());

    expect(result.current.dark).toBe(false);
    expect(result.current.colors.background).toBe(lightColors.background);
  });
});
