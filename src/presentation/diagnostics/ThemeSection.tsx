import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, useTheme, useThemeMode, type ThemeMode } from '../theme';
import { DiagnosticsSection } from './DiagnosticsSection';

/**
 * The diagnostics theme switcher — flips the app between following the OS
 * appearance (`system`) and forcing `light` / `dark`. Unlike the environment /
 * mocking switches this applies **immediately** (no restart-to-apply): it drives
 * `useThemeMode().setMode`, which re-themes the tree on the next render. The
 * active mode shows as the filled (`primary`) button.
 */
const MODE_OPTIONS = [
  { mode: 'system', labelKey: 'diagnostics.theme.system' },
  { mode: 'light', labelKey: 'diagnostics.theme.light' },
  { mode: 'dark', labelKey: 'diagnostics.theme.dark' },
] as const satisfies readonly { mode: ThemeMode; labelKey: string }[];

export function ThemeSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();

  return (
    <DiagnosticsSection title={t('diagnostics.theme.title')}>
      <AppText tone="muted">{t('diagnostics.theme.hint')}</AppText>
      <View style={{ gap: theme.spacing.sm }}>
        {MODE_OPTIONS.map((option) => (
          <Button
            key={option.mode}
            testID={`DiagnosticsTheme-${option.mode}`}
            label={t(option.labelKey)}
            variant={option.mode === mode ? 'primary' : 'outline'}
            onPress={() => setMode(option.mode)}
          />
        ))}
      </View>
    </DiagnosticsSection>
  );
}
