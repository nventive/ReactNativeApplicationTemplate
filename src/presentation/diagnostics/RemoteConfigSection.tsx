import { useTranslation } from 'react-i18next';

import { REMOTE_CONFIG_DEFAULTS } from '../../access/remoteConfig/RemoteConfig';
import { version } from '../../access/version/Version';
import { useServices } from '../../framework/composition/ServicesProvider';
import { useObservable } from '../hooks/useObservable';
import { AppText, Button } from '../theme';
import { DiagnosticsSection } from './DiagnosticsSection';

/** A minimum version far above any real build, used to force the update gate. */
const FORCE_UPDATE_VERSION = version(999, 0, 0);

/**
 * The mock-only diagnostics triggers — force an update or toggle the
 * kill switch by pushing values into the {@link MockRemoteConfigProvider}. Shown
 * only when mocking is active (the composition root exposes
 * `remoteConfigController` only then), so the trigger buttons appear only with
 * the mock repositories registered.
 */
export function RemoteConfigSection() {
  const { t } = useTranslation();
  const { remoteConfig, remoteConfigController } = useServices();
  const values = useObservable(remoteConfig.values$, remoteConfig.getValues());

  if (remoteConfigController === null) {
    return (
      <DiagnosticsSection title={t('diagnostics.remoteConfig.title')}>
        <AppText tone="muted">{t('diagnostics.remoteConfig.unavailable')}</AppText>
      </DiagnosticsSection>
    );
  }

  return (
    <DiagnosticsSection title={t('diagnostics.remoteConfig.title')}>
      <Button
        testID="DiagnosticsForceUpdate"
        variant="outline"
        label={t('diagnostics.remoteConfig.triggerForcedUpdate')}
        onPress={() => remoteConfigController.setMinimumVersion(FORCE_UPDATE_VERSION)}
      />
      <Button
        testID="DiagnosticsClearForceUpdate"
        variant="outline"
        label={t('diagnostics.remoteConfig.clearForcedUpdate')}
        onPress={() =>
          remoteConfigController.setMinimumVersion(REMOTE_CONFIG_DEFAULTS.minimumVersion)
        }
      />
      <Button
        testID="DiagnosticsToggleKillSwitch"
        variant="outline"
        label={t('diagnostics.remoteConfig.toggleKillSwitch')}
        onPress={() => remoteConfigController.toggleKillSwitch()}
      />
      <AppText tone="muted" variant="caption">
        {t('diagnostics.remoteConfig.killSwitchState', {
          state: values.killSwitchActive ? t('common.on') : t('common.off'),
        })}
      </AppText>
    </DiagnosticsSection>
  );
}
