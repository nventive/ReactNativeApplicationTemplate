import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Screen, useTheme } from '../theme';

/**
 * Demo modal — proves modal presentation and back-to-dismiss in the shell.
 * Real modal content arrives with the features that need it.
 */
export function ExampleModalScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();

  return (
    <Screen center padded testID="ExampleModal">
      <AppText variant="title" style={{ marginBottom: theme.spacing.md }}>
        {t('modal.title')}
      </AppText>
      <AppText tone="muted" style={{ textAlign: 'center', marginBottom: theme.spacing.lg }}>
        {t('modal.body')}
      </AppText>
      <Button label={t('modal.close')} onPress={() => navigation.goBack()} />
    </Screen>
  );
}
