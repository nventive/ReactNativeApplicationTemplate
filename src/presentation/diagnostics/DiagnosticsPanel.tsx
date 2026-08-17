import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useServices } from '../../framework/composition/ServicesProvider';
import { Button, useTheme } from '../theme';
import { AppInfoSection } from './AppInfoSection';
import { CrashReportingSection } from './CrashReportingSection';
import { DiagnosticsScreen } from './DiagnosticsScreen';
import { DiagnosticsSection } from './DiagnosticsSection';
import { EnvironmentSection } from './EnvironmentSection';
import { LoggingSection } from './LoggingSection';
import { MockingSection } from './MockingSection';
import { RemoteConfigSection } from './RemoteConfigSection';
import { ThemeSection } from './ThemeSection';

/**
 * The main diagnostics page — hosts every inline diagnostic section plus links to
 * the dedicated tool pages (log console, network inspector) and the dismissal
 * tiers.
 *
 * `onClose` collapses back to the launcher; `onOpenLogConsole` / `onOpenNetwork`
 * push the dedicated pages (the overlay's own navigation, since it lives outside
 * the React Navigation tree). "Hide for this session" and "Disable diagnostics"
 * call `DiagnosticsService`, which lowers availability and unmounts the whole
 * overlay (permanently, for the latter).
 */
export function DiagnosticsPanel({
  onClose,
  onOpenLogConsole,
  onOpenNetwork,
}: {
  onClose: () => void;
  onOpenLogConsole: () => void;
  onOpenNetwork: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { diagnostics } = useServices();

  return (
    <DiagnosticsScreen testID="DiagnosticsPanel" title={t('diagnostics.title')} onClose={onClose}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <AppInfoSection />
        <ThemeSection />
        <EnvironmentSection />
        <MockingSection />
        <RemoteConfigSection />
        <CrashReportingSection />
        <LoggingSection />

        <DiagnosticsSection title={t('diagnostics.tools.title')}>
          <Button
            testID="DiagnosticsOpenLogConsole"
            variant="outline"
            label={t('diagnostics.tools.logConsole')}
            onPress={onOpenLogConsole}
          />
          <Button
            testID="DiagnosticsOpenNetwork"
            variant="outline"
            label={t('diagnostics.tools.network')}
            onPress={onOpenNetwork}
          />
        </DiagnosticsSection>

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          <Button
            testID="DiagnosticsDismiss"
            variant="outline"
            label={t('diagnostics.dismiss')}
            onPress={() => diagnostics.dismissForSession()}
          />
          <Button
            testID="DiagnosticsDisable"
            variant="outline"
            label={t('diagnostics.disable')}
            onPress={() => {
              void diagnostics.disablePermanently();
            }}
          />
        </View>
      </ScrollView>
    </DiagnosticsScreen>
  );
}
