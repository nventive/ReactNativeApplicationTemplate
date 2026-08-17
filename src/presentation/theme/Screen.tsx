import { View, type ViewProps } from 'react-native';

import { useTheme } from './ThemeProvider';

interface ScreenProps extends ViewProps {
  /** Apply the standard screen padding. */
  padded?: boolean;
  /** Center children horizontally and vertically (empty/error states). */
  center?: boolean;
}

/**
 * The root container for a screen: fills the space and paints the themed
 * background, so no screen repeats `flex: 1` + a hardcoded background color.
 */
export function Screen({ padded = false, center = false, style, ...rest }: ScreenProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        { flex: 1, backgroundColor: theme.colors.background },
        padded && { padding: theme.spacing.xl },
        center && { alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    />
  );
}
