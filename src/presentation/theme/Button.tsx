import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { useTheme } from './ThemeProvider';

interface ButtonProps {
  /** Localized label — always pass `t('key')`, never a raw string. */
  label: string;
  onPress: () => void;
  /** Solid brand button (default) or a bordered/transparent one. */
  variant?: 'primary' | 'outline';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The themed primary action button, used across screens so button styling lives
 * in one place. `primary` fills with the brand color; `outline` is a bordered,
 * transparent variant for secondary actions.
 */
export function Button({ label, onPress, variant = 'primary', style, testID }: ButtonProps) {
  const theme = useTheme();
  const isOutline = variant === 'outline';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.radius.sm,
          alignItems: 'center',
          backgroundColor: isOutline ? 'transparent' : theme.colors.primary,
          borderWidth: isOutline ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.colors.primary,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <AppText
        variant="button"
        tone={isOutline ? 'default' : 'onPrimary'}
        style={isOutline ? { color: theme.colors.primary } : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
