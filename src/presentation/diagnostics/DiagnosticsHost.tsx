import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useServices } from '../../framework/composition/ServicesProvider';
import { useObservable } from '../hooks/useObservable';
import { AppText, useTheme } from '../theme';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { LogConsoleScreen } from './LogConsoleScreen';
import { NetworkDetailScreen } from './NetworkDetailScreen';
import { NetworkInspectorScreen } from './NetworkInspectorScreen';

/**
 * The overlay's own page, since it lives outside the React Navigation tree
 * (mounted outside `AppGate` so it stays reachable during a forced-update /
 * kill-switch block). `closed` shows just the launcher; the rest are full-screen
 * pages pushed over the app.
 */
type DiagnosticsView =
  | { name: 'closed' }
  | { name: 'panel' }
  | { name: 'logConsole' }
  | { name: 'network' }
  | { name: 'networkDetail'; id: string };

/**
 * Mounts the diagnostics overlay above the whole app, stacking the launcher
 * (and, when open, the current diagnostics page) over the routed child.
 *
 * It sits **outside** {@link AppGate} on purpose: the launcher stays reachable
 * even while a forced-update or kill-switch block is showing, so a tester can
 * open it and toggle the mock flags back off. Availability comes from
 * `DiagnosticsService` (off in production; dismissable/disable-able), so nothing
 * renders when diagnostics are unavailable.
 */
export function DiagnosticsHost({ children }: { children: ReactNode }) {
  const { diagnostics } = useServices();
  const available = useObservable(diagnostics.isAvailable$, diagnostics.isAvailable());
  const [view, setView] = useState<DiagnosticsView>({ name: 'closed' });

  return (
    <View style={{ flex: 1 }}>
      {children}
      {available && view.name === 'closed' && (
        <DiagnosticsLauncher onOpen={() => setView({ name: 'panel' })} />
      )}
      {available && view.name === 'panel' && (
        <DiagnosticsPanel
          onClose={() => setView({ name: 'closed' })}
          onOpenLogConsole={() => setView({ name: 'logConsole' })}
          onOpenNetwork={() => setView({ name: 'network' })}
        />
      )}
      {available && view.name === 'logConsole' && (
        <LogConsoleScreen onBack={() => setView({ name: 'panel' })} />
      )}
      {available && view.name === 'network' && (
        <NetworkInspectorScreen
          onBack={() => setView({ name: 'panel' })}
          onSelect={(id) => setView({ name: 'networkDetail', id })}
        />
      )}
      {available && view.name === 'networkDetail' && (
        <NetworkDetailScreen id={view.id} onBack={() => setView({ name: 'network' })} />
      )}
    </View>
  );
}

/** The floating pill that opens the panel (an always-on edge overlay button). */
function DiagnosticsLauncher({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      testID="DiagnosticsLauncher"
      accessibilityRole="button"
      onPress={onOpen}
      style={{
        position: 'absolute',
        right: theme.spacing.lg,
        bottom: insets.bottom + theme.spacing.xxl * 2,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.primary,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
      }}
    >
      <AppText tone="onPrimary" variant="caption">
        {t('diagnostics.launcher')}
      </AppText>
    </Pressable>
  );
}
