import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { of } from 'rxjs';

import { shouldLog } from '../../access/logger/LevelFilter';
import type { LogEntry } from '../../access/logger/Logger';
import type { LogLevel } from '../../access/logger/LogLevel';
import { isNetworkLogEntry } from '../../access/logger/LogCategory';
import { useServices } from '../../framework/composition/ServicesProvider';
import { useObservable } from '../hooks/useObservable';
import { AppText, Button, type Theme, useTheme } from '../theme';
import { DiagnosticsScreen } from './DiagnosticsScreen';

/** Stable empty stream so the hook order stays constant when no buffer exists. */
const EMPTY_ENTRIES: readonly LogEntry[] = [];
const EMPTY_ENTRIES$ = of(EMPTY_ENTRIES);

/** A single-selection filter: everything, a minimum level, or the network category. */
type LogFilter = 'all' | 'network' | Extract<LogLevel, 'debug' | 'info' | 'warn' | 'error'>;

const FILTERS = [
  { key: 'all', labelKey: 'diagnostics.logConsole.filters.all' },
  { key: 'network', labelKey: 'diagnostics.logConsole.filters.network' },
  { key: 'debug', labelKey: 'diagnostics.logConsole.filters.debug' },
  { key: 'info', labelKey: 'diagnostics.logConsole.filters.info' },
  { key: 'warn', labelKey: 'diagnostics.logConsole.filters.warn' },
  { key: 'error', labelKey: 'diagnostics.logConsole.filters.error' },
] as const satisfies readonly { key: LogFilter; labelKey: string }[];

/**
 * The dedicated in-app log console page with a network filter. It renders the live
 * in-memory {@link LogEntry} buffer newest-first, filterable by minimum level or by the
 * `network` category, in a full-screen `FlatList` so it doesn't crowd the
 * diagnostics panel with a large scroll area.
 *
 * The buffer only holds entries at/above the active minimum level, so the console
 * shows full `debug` detail in development and higher-level entries elsewhere. It
 * is unavailable where diagnostics is off (production) — `logBuffer` is `null`.
 */
export function LogConsoleScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { logBuffer } = useServices();
  const entries = useObservable(
    logBuffer?.entries$ ?? EMPTY_ENTRIES$,
    logBuffer?.getEntries() ?? EMPTY_ENTRIES,
  );
  const [filter, setFilter] = useState<LogFilter>('all');

  const visible = entries.filter((entry) => matchesFilter(entry, filter)).reverse();

  const clearButton =
    logBuffer !== null ? (
      <Button
        testID="DiagnosticsLogConsoleClear"
        variant="outline"
        label={t('diagnostics.logConsole.clear')}
        onPress={() => logBuffer.clear()}
      />
    ) : undefined;

  return (
    <DiagnosticsScreen
      testID="DiagnosticsLogConsoleScreen"
      title={t('diagnostics.logConsole.title')}
      onBack={onBack}
      right={clearButton}
    >
      {logBuffer === null ? (
        <View style={{ padding: theme.spacing.lg }}>
          <AppText tone="muted">{t('diagnostics.logConsole.unavailable')}</AppText>
        </View>
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.xs,
              padding: theme.spacing.md,
            }}
          >
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                testID={`DiagnosticsLogFilter-${f.key}`}
                label={t(f.labelKey)}
                variant={f.key === filter ? 'primary' : 'outline'}
                onPress={() => setFilter(f.key)}
                style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs }}
              />
            ))}
          </View>
          <FlatList
            testID="DiagnosticsLogConsole"
            data={visible}
            keyExtractor={(entry, index) => `${entry.timestamp.getTime()}-${index}`}
            renderItem={({ item }) => <LogRow entry={item} />}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.lg,
              gap: theme.spacing.sm,
            }}
            ListEmptyComponent={
              <AppText tone="muted" testID="DiagnosticsLogConsoleEmpty">
                {t('diagnostics.logConsole.empty')}
              </AppText>
            }
          />
        </>
      )}
    </DiagnosticsScreen>
  );
}

/** One log line: time + colored level tag on top, the message below. */
function LogRow({ entry }: { entry: LogEntry }) {
  const { t } = useTranslation();
  const theme = useTheme();
  // Static keys (no dynamic construction) so the typed `t` keeps checking them.
  const levelLabels: Record<LogLevel, string> = {
    trace: t('diagnostics.logConsole.levels.trace'),
    debug: t('diagnostics.logConsole.levels.debug'),
    info: t('diagnostics.logConsole.levels.info'),
    warn: t('diagnostics.logConsole.levels.warn'),
    error: t('diagnostics.logConsole.levels.error'),
    fatal: t('diagnostics.logConsole.levels.fatal'),
  };
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <AppText tone="muted" variant="caption">
          {formatTime(entry.timestamp)}
        </AppText>
        <AppText variant="caption" style={{ color: levelColor(theme, entry.level) }}>
          {levelLabels[entry.level]}
        </AppText>
      </View>
      <AppText variant="caption">{entry.message}</AppText>
    </View>
  );
}

function matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'network') return isNetworkLogEntry(entry);
  return shouldLog(entry.level, filter);
}

/** `HH:MM:SS` from a Date, locale-independent (drops the timezone suffix). */
function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

function levelColor(theme: Theme, level: LogLevel): string {
  switch (level) {
    case 'trace':
    case 'debug':
      return theme.colors.onSurfaceMuted;
    case 'info':
      return theme.colors.onSurface;
    case 'warn':
      return theme.colors.warning;
    case 'error':
    case 'fatal':
      return theme.colors.error;
  }
}
