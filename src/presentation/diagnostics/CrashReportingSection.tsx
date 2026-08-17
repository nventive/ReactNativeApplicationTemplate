import { useTranslation } from 'react-i18next';

import { useServices } from '../../framework/composition/ServicesProvider';
import { AppText, Button } from '../theme';
import { DiagnosticsSection } from './DiagnosticsSection';

/**
 * The crash-reporting diagnostics section. It surfaces whether reporting is active for this
 * build and, when it is, a button to send a **test exception** so an internal
 * build can be verified against the Bugsee dashboard.
 *
 * On production/store builds (or internal builds with no token) the reporter is
 * the no-op, so this shows the disabled state and hides the trigger.
 */
export function CrashReportingSection() {
  const { t } = useTranslation();
  const { crashReporter } = useServices();

  return (
    <DiagnosticsSection title={t('diagnostics.crashReporting.title')}>
      <AppText tone="muted" variant="caption">
        {crashReporter.isEnabled
          ? t('diagnostics.crashReporting.enabled')
          : t('diagnostics.crashReporting.disabled')}
      </AppText>
      {crashReporter.isEnabled && (
        <Button
          testID="DiagnosticsLogTestException"
          variant="outline"
          label={t('diagnostics.crashReporting.logTestException')}
          onPress={() =>
            crashReporter.recordError(new Error('Diagnostics test exception'), {
              source: 'diagnostics',
            })
          }
        />
      )}
    </DiagnosticsSection>
  );
}
