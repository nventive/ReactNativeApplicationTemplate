import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from './AppText';
import { useTheme } from './ThemeProvider';

interface TextFieldProps extends TextInputProps {
  /** Localized field label — always pass `t('key')`, never a raw string. */
  label: string;
  /** Localized validation message; when set, the field renders its error state. */
  error?: string;
  testID?: string;
}

/**
 * The themed labeled text input — the design-system primitive forms are built
 * from, so a form never restyles a bare `TextInput`. Renders a label, a bordered
 * input that turns to the error color when {@link error} is set, and the error
 * message beneath it. Colors, spacing, radii, and typography come from the theme.
 *
 * `forwardRef` so `react-hook-form` can focus the field programmatically. All
 * other `TextInput` props (keyboardType, autoCapitalize, multiline, …) pass
 * through.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, style, testID, ...rest },
  ref,
) {
  const theme = useTheme();
  const hasError = error !== undefined && error.length > 0;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="subtitle" tone="muted">
        {label}
      </AppText>
      <TextInput
        ref={ref}
        testID={testID}
        placeholderTextColor={theme.colors.onSurfaceMuted}
        style={[
          {
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: hasError ? theme.colors.error : theme.colors.border,
            borderRadius: theme.radius.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            backgroundColor: theme.colors.surface,
            color: theme.colors.onSurface,
            ...theme.typography.body,
          },
          style,
        ]}
        {...rest}
      />
      {hasError && (
        <AppText tone="error" variant="caption">
          {error}
        </AppText>
      )}
    </View>
  );
});
