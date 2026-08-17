import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from './ThemeProvider';

/**
 * A themed elevated surface. Rounded,
 * bordered, and padded from the theme; screens compose content inside it
 * instead of restyling a bare `View`.
 */
export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          padding: theme.spacing.lg,
        },
        style,
      ]}
    />
  );
}
