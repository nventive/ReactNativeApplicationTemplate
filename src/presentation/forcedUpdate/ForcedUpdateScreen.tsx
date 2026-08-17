import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { useServices } from '../../framework/composition/ServicesProvider';
import { AppText, Button, Screen, useTheme } from '../theme';

/**
 * The blocking forced-update screen — rendered by {@link AppGate} instead of the
 * app (no navigation, no back) while `forcedUpdate.isUpdateRequired$` is `true`.
 *
 * The update button opens the platform store URL from the active environment
 * (`appStoreUrl.ios` / `appStoreUrl.android`) through the injected `UrlLauncher`;
 * a launch failure surfaces the localized error inline.
 */
export function ForcedUpdateScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { environment, urlLauncher } = useServices();
  const [error, setError] = useState<string | null>(null);

  async function openStore() {
    const { appStoreUrl } = environment.getConfig();
    const url = Platform.OS === 'ios' ? appStoreUrl.ios : appStoreUrl.android;
    try {
      await urlLauncher.openUrl(url);
      setError(null);
    } catch {
      setError(t('forcedUpdate.urlLaunchError', { url }));
    }
  }

  return (
    <Screen center padded testID="ForcedUpdateScreen">
      <AppText variant="title" style={{ marginBottom: theme.spacing.md, textAlign: 'center' }}>
        {t('forcedUpdate.title')}
      </AppText>
      <AppText tone="muted" style={{ marginBottom: theme.spacing.xl, textAlign: 'center' }}>
        {t('forcedUpdate.message')}
      </AppText>
      <Button
        testID="ForcedUpdateButton"
        label={t('forcedUpdate.button')}
        onPress={() => {
          void openStore();
        }}
      />
      {error !== null && (
        <AppText tone="error" style={{ marginTop: theme.spacing.lg, textAlign: 'center' }}>
          {error}
        </AppText>
      )}
    </Screen>
  );
}
