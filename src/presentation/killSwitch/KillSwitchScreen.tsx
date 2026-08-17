import { useTranslation } from 'react-i18next';

import { AppText, Screen, useTheme } from '../theme';

/**
 * The blocking kill-switch screen — a message-only screen with no interactive
 * controls. {@link AppGate} shows it while
 * `killSwitch.isKillSwitchActive$` is `true`, and removes it automatically when
 * the remote flag lifts (in-session recovery).
 */
export function KillSwitchScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Screen center padded testID="KillSwitchScreen">
      <AppText variant="title" style={{ marginBottom: theme.spacing.md, textAlign: 'center' }}>
        {t('killSwitch.title')}
      </AppText>
      <AppText tone="muted" style={{ textAlign: 'center' }}>
        {t('killSwitch.message')}
      </AppText>
    </Screen>
  );
}
