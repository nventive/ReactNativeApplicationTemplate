import { Text, type TextProps } from 'react-native';

import { useTheme } from './ThemeProvider';
import type { TypographyVariant } from './tokens';

/** Text color role, resolved from the theme. */
type Tone = 'default' | 'muted' | 'onPrimary' | 'error';

interface AppTextProps extends TextProps {
  /** Typographic variant (size + weight) from the theme. Defaults to `body`. */
  variant?: TypographyVariant;
  /** Color role from the theme. Defaults to `default` (primary on-surface). */
  tone?: Tone;
}

/**
 * Themed `Text` — the one place app copy picks up size, weight, and color from
 * the theme, so screens never hardcode a `fontSize`/`color`. Forwards all other
 * `Text` props (numberOfLines, accessibility, style overrides, …).
 */
export function AppText({ variant = 'body', tone = 'default', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const color = toneColor(theme, tone);
  return <Text {...rest} style={[theme.typography[variant], { color }, style]} />;
}

function toneColor(theme: ReturnType<typeof useTheme>, tone: Tone): string {
  switch (tone) {
    case 'muted':
      return theme.colors.onSurfaceMuted;
    case 'onPrimary':
      return theme.colors.onPrimary;
    case 'error':
      return theme.colors.error;
    default:
      return theme.colors.onSurface;
  }
}
