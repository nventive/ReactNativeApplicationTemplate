import { useTranslation } from 'react-i18next';

import { useServices } from '../../framework/composition/ServicesProvider';
import { AppText } from '../theme';
import { DiagnosticsSection } from './DiagnosticsSection';

/**
 * Shows the running build's identity — app name, marketing version, native build
 * number, bundle id, and the device's platform / OS version — read from
 * `AppInfoRepository` (a plain synchronous config read, no loading state). Useful
 * for confirming which build is on which device when triaging a report off an
 * unknown device. The version comes from GitVersion in CI (see
 * `doc/AzurePipelines.md` § "Versioning").
 */
export function AppInfoSection() {
  const { t } = useTranslation();
  const { appInfo } = useServices();
  const info = appInfo.getAppInfo();

  return (
    <DiagnosticsSection title={t('diagnostics.appInfo.title')}>
      <AppText tone="muted" testID="DiagnosticsAppName">
        {t('diagnostics.appInfo.name', { name: info.name })}
      </AppText>
      <AppText testID="DiagnosticsAppVersion">
        {t('diagnostics.appInfo.version', {
          version: info.version,
          buildNumber: info.buildNumber,
        })}
      </AppText>
      <AppText tone="muted" testID="DiagnosticsAppBundleId">
        {t('diagnostics.appInfo.bundleId', { bundleId: info.bundleId })}
      </AppText>
      <AppText tone="muted" testID="DiagnosticsAppPlatform">
        {t('diagnostics.appInfo.platform', { platform: info.platform })}
      </AppText>
      <AppText tone="muted" testID="DiagnosticsAppOsVersion">
        {t('diagnostics.appInfo.osVersion', { osVersion: info.osVersion })}
      </AppText>
    </DiagnosticsSection>
  );
}
