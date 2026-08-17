import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useServices } from '../../framework/composition/ServicesProvider';
import { useObservable } from '../hooks/useObservable';
import { AppText, Button, useTheme } from '../theme';
import { DiagnosticsSection } from './DiagnosticsSection';

/**
 * The diagnostics environment picker — drives `EnvironmentService` with
 * the restart-to-apply flow. Selecting an environment persists the
 * override and shows the "restart to apply" banner while `pending$` differs from
 * the active one.
 */
export function EnvironmentSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { environment } = useServices();
  const current = useObservable(environment.current$, environment.getCurrent());
  const pending = useObservable(environment.pending$, null);

  return (
    <DiagnosticsSection title={t('diagnostics.environment.title')}>
      <AppText tone="muted">{t('diagnostics.environment.current', { name: current })}</AppText>
      <View style={{ gap: theme.spacing.sm }}>
        {environment.available.map((env) => (
          <Button
            key={env}
            testID={`DiagnosticsEnv-${env}`}
            label={env}
            variant={env === current ? 'primary' : 'outline'}
            onPress={() => {
              void environment.setEnvironment(env);
            }}
          />
        ))}
      </View>
      {pending !== null && (
        <AppText tone="error" testID="DiagnosticsEnvPending">
          {t('diagnostics.environment.pending', { name: pending })}
        </AppText>
      )}
    </DiagnosticsSection>
  );
}
