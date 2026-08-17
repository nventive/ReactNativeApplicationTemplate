import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';

import { useServices } from '../../framework/composition/ServicesProvider';
import { useObservable } from '../hooks/useObservable';
import { AppText, useTheme } from '../theme';
import { DiagnosticsSection } from './DiagnosticsSection';

/**
 * The diagnostics mocking toggle — flips the persisted real-vs-mock
 * flag. Like the environment switch it is **applied on restart**: the toggle
 * persists immediately and raises the "restart to apply" banner, but the running
 * graph keeps the data sources it was built with (the composition root reads the
 * flag once at startup).
 */
export function MockingSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { mocking } = useServices();
  const enabled = useObservable(mocking.isEnabled$, mocking.isEnabled());
  const pending = useObservable(mocking.hasPendingChange$, false);

  return (
    <DiagnosticsSection title={t('diagnostics.mocking.title')}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <AppText style={{ flexShrink: 1 }}>{t('diagnostics.mocking.label')}</AppText>
        <Switch
          testID="DiagnosticsMockingSwitch"
          value={enabled}
          onValueChange={(value) => mocking.setEnabled(value)}
        />
      </View>
      <AppText tone="muted" variant="caption">
        {t('diagnostics.mocking.hint')}
      </AppText>
      {pending && (
        <AppText tone="error" testID="DiagnosticsMockingPending">
          {t('diagnostics.restartRequired')}
        </AppText>
      )}
    </DiagnosticsSection>
  );
}
