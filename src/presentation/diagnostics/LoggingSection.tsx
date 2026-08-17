import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';

import { useServices } from '../../framework/composition/ServicesProvider';
import { useObservable } from '../hooks/useObservable';
import { AppText, Button, useTheme } from '../theme';
import { DiagnosticsSection } from './DiagnosticsSection';

/**
 * The logging controls section — the runtime console/file transport toggles
 * (restart-to-apply, like the environment/mocking switches) plus the file
 * actions: generate test logs, share the actual `.log` file via the OS sheet, and
 * clear it.
 *
 * "Console logging" is the native console sink (Metro / adb logcat / Xcode) — the
 * logs read over USB with the device plugged into a computer. Both toggles feed
 * construction-time dependencies the composition root reads once, so a change
 * persists immediately but applies on the next launch (red banner until then).
 *
 * The live in-app log list is a separate page (`LogConsoleScreen`, opened from the
 * panel's Tools section); when the file transport is off, `logReader` is `null`
 * and the share/clear actions are replaced with an explanatory line.
 */
export function LoggingSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { logger, logReader, fileSharer, logging } = useServices();
  const consoleEnabled = useObservable(logging.console$, logging.getConsoleEnabled());
  const fileEnabled = useObservable(logging.file$, logging.getFileEnabled());
  const pending = useObservable(logging.hasPendingChange$, false);
  const [status, setStatus] = useState<string | null>(null);

  async function shareLogs() {
    if (logReader === null) return;
    try {
      // `read()` flushes buffered writes, so the file on disk is current and we
      // can tell an empty log from a missing one before opening the share sheet.
      const contents = await logReader.read();
      if (contents.trim().length === 0) {
        setStatus(t('diagnostics.logging.empty'));
        return;
      }
      if (!(await fileSharer.isAvailable())) {
        setStatus(t('diagnostics.logging.shareUnavailable'));
        return;
      }
      // Share the actual .log FILE (via its file:// URI), not the log text —
      // so recipients get a proper attachment on both platforms.
      await fileSharer.shareFile(logReader.getUri(), {
        mimeType: 'text/plain',
        dialogTitle: t('diagnostics.logging.share'),
        uti: 'public.plain-text',
      });
      setStatus(null);
    } catch {
      setStatus(t('diagnostics.logging.shareError'));
    }
  }

  async function clearLogs() {
    if (logReader === null) return;
    await logReader.clear();
    setStatus(t('diagnostics.logging.cleared'));
  }

  function generateTestLogs() {
    logger.debug('Diagnostics test log · debug');
    logger.info('Diagnostics test log · info');
    logger.warn('Diagnostics test log · warn');
    logger.error('Diagnostics test log · error');
    setStatus(t('diagnostics.logging.generated'));
  }

  return (
    <DiagnosticsSection title={t('diagnostics.logging.title')}>
      <ToggleRow
        testID="DiagnosticsConsoleLoggingSwitch"
        label={t('diagnostics.logging.console')}
        hint={t('diagnostics.logging.consoleHint')}
        value={consoleEnabled}
        onValueChange={(value) => logging.setConsoleEnabled(value)}
      />
      <ToggleRow
        testID="DiagnosticsFileLoggingSwitch"
        label={t('diagnostics.logging.file')}
        hint={t('diagnostics.logging.fileHint')}
        value={fileEnabled}
        onValueChange={(value) => logging.setFileEnabled(value)}
      />
      {pending && (
        <AppText tone="error" testID="DiagnosticsLoggingPending">
          {t('diagnostics.restartRequired')}
        </AppText>
      )}

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        <Button
          testID="DiagnosticsGenerateLogs"
          variant="outline"
          label={t('diagnostics.logging.generate')}
          onPress={generateTestLogs}
        />
        {logReader === null ? (
          <AppText tone="muted" variant="caption">
            {t('diagnostics.logging.unavailable')}
          </AppText>
        ) : (
          <>
            <Button
              testID="DiagnosticsShareLogs"
              variant="outline"
              label={t('diagnostics.logging.share')}
              onPress={() => {
                void shareLogs();
              }}
            />
            <Button
              testID="DiagnosticsClearLogs"
              variant="outline"
              label={t('diagnostics.logging.clear')}
              onPress={() => {
                void clearLogs();
              }}
            />
          </>
        )}
      </View>
      {status !== null && (
        <AppText tone="muted" testID="DiagnosticsLogStatus">
          {status}
        </AppText>
      )}
    </DiagnosticsSection>
  );
}

/** A labelled switch row with a caption hint — mirrors the mocking toggle. */
function ToggleRow({
  testID,
  label,
  hint,
  value,
  onValueChange,
}: {
  testID: string;
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <AppText style={{ flexShrink: 1 }}>{label}</AppText>
        <Switch testID={testID} value={value} onValueChange={onValueChange} />
      </View>
      <AppText tone="muted" variant="caption">
        {hint}
      </AppText>
    </View>
  );
}
