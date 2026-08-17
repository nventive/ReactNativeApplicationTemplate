import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';

import { useServices } from '../../framework/composition/ServicesProvider';
import { useTheme } from '../theme';
import { navigationRef } from './navigationRef';
import { RootNavigator } from './RootNavigator';

/**
 * Hosts the `NavigationContainer`, wiring the imperative `navigationRef` and an
 * `onStateChange` logger that records route changes and tracks the current
 * path. Lives inside
 * `ServicesProvider` so it can reach the `Logger`, and inside `ThemeProvider`
 * so headers/tab bars/backgrounds pick up the design-system palette.
 */
export function NavigationRoot() {
  const { logger, analytics } = useServices();
  const navigationTheme = useNavigationTheme();

  // Log the route change and report the screen view through the analytics seam.
  // Called on `onReady` (the initial screen, which `onStateChange` skips) and on
  // every subsequent navigation change.
  function trackCurrentRoute() {
    const route = navigationRef.getCurrentRoute();
    if (route) {
      logger.debug(`Navigation → ${route.name}`);
      analytics.trackScreenView(route.name);
    }
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={trackCurrentRoute}
      onStateChange={trackCurrentRoute}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}

/** Bridges the design-system theme into React Navigation's own theme shape. */
function useNavigationTheme(): NavigationTheme {
  const theme = useTheme();
  const base = theme.dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.onSurface,
      border: theme.colors.border,
    },
  };
}
