import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { of } from 'rxjs';

import type { NetworkExchange } from '../../access/http/NetworkInspector';
import { useServices } from '../../framework/composition/ServicesProvider';
import { useObservable } from '../hooks/useObservable';
import { AppText, Button, type Theme, useTheme } from '../theme';
import { DiagnosticsScreen } from './DiagnosticsScreen';

/** Stable empty stream so the hook order stays constant when no inspector exists. */
const EMPTY_EXCHANGES: readonly NetworkExchange[] = [];
const EMPTY_EXCHANGES$ = of(EMPTY_EXCHANGES);

/**
 * The dedicated in-app HTTP inspector list page. It renders captured
 * request/response exchanges newest-first; tapping a row opens the detail page
 * (headers / payload / timing).
 *
 * The store is populated only when diagnostics is enabled (the capture
 * interceptor is wired then), so `networkInspector` is `null` in production.
 */
export function NetworkInspectorScreen({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { networkInspector } = useServices();
  const exchanges = useObservable(
    networkInspector?.exchanges$ ?? EMPTY_EXCHANGES$,
    networkInspector?.getExchanges() ?? EMPTY_EXCHANGES,
  );

  const visible = [...exchanges].reverse();

  const clearButton =
    networkInspector !== null ? (
      <Button
        testID="DiagnosticsNetworkClear"
        variant="outline"
        label={t('diagnostics.network.clear')}
        onPress={() => networkInspector.clear()}
      />
    ) : undefined;

  return (
    <DiagnosticsScreen
      testID="DiagnosticsNetworkScreen"
      title={t('diagnostics.network.title')}
      onBack={onBack}
      right={clearButton}
    >
      {networkInspector === null ? (
        <View style={{ padding: theme.spacing.lg }}>
          <AppText tone="muted">{t('diagnostics.network.unavailable')}</AppText>
        </View>
      ) : (
        <FlatList
          testID="DiagnosticsNetworkList"
          data={visible}
          keyExtractor={(exchange) => exchange.id}
          renderItem={({ item }) => (
            <ExchangeRow exchange={item} onPress={() => onSelect(item.id)} />
          )}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
          ListEmptyComponent={
            <AppText tone="muted" testID="DiagnosticsNetworkEmpty">
              {t('diagnostics.network.empty')}
            </AppText>
          }
        />
      )}
    </DiagnosticsScreen>
  );
}

/** One request row: status indicator + method + status/duration + URL. */
function ExchangeRow({ exchange, onPress }: { exchange: NetworkExchange; onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const statusText =
    exchange.state === 'pending'
      ? t('diagnostics.network.states.pending')
      : (exchange.status?.toString() ?? t('diagnostics.network.states.failure'));
  const duration =
    exchange.durationMs !== undefined
      ? t('diagnostics.network.durationValue', { ms: exchange.durationMs })
      : '';

  return (
    <Pressable
      testID={`DiagnosticsNetworkRow-${exchange.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        gap: 2,
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <AppText
          variant="caption"
          style={{ color: stateColor(theme, exchange), fontWeight: '600' }}
        >
          {statusText}
        </AppText>
        <AppText variant="caption" style={{ fontWeight: '600' }}>
          {exchange.method}
        </AppText>
        {duration.length > 0 && (
          <AppText variant="caption" tone="muted">
            {duration}
          </AppText>
        )}
      </View>
      <AppText variant="caption" numberOfLines={1}>
        {exchange.url}
      </AppText>
    </Pressable>
  );
}

function stateColor(theme: Theme, exchange: NetworkExchange): string {
  switch (exchange.state) {
    case 'pending':
      return theme.colors.onSurfaceMuted;
    case 'failure':
      return theme.colors.error;
    case 'success':
      return exchange.status !== undefined && exchange.status >= 400
        ? theme.colors.warning
        : theme.colors.onSurface;
  }
}
