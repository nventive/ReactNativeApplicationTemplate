import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './theme';

/** How the active theme is chosen: follow the OS, or force light/dark. */
export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  readonly theme: Theme;
  readonly mode: ThemeMode;
  readonly setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Provides the resolved `Theme` to the tree and a `setMode` to switch between
 * system / light / dark at runtime (the "light/dark switch" — a UI for it lives
 * in the diagnostics overlay). In `system` mode the OS color scheme wins
 * and the app re-themes automatically when the device toggles dark mode.
 */
export function ThemeProvider({
  children,
  initialMode = 'system',
}: {
  children: ReactNode;
  initialMode?: ThemeMode;
}) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const value = useMemo<ThemeContextValue>(() => {
    const resolved = mode === 'system' ? (systemScheme ?? 'light') : mode;
    return { theme: resolved === 'dark' ? darkTheme : lightTheme, mode, setMode };
  }, [mode, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * The active theme. Falls back to the light theme when used outside a
 * `ThemeProvider` (e.g. a component rendered in isolation in a test) so a
 * missing provider never crashes a render — a theme has a sensible default,
 * unlike services.
 */
export function useTheme(): Theme {
  return useContext(ThemeContext)?.theme ?? lightTheme;
}

/** The current mode and the setter that switches it (requires a provider). */
export function useThemeMode(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return { mode: context.mode, setMode: context.setMode };
}
