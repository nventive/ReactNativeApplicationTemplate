import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { of } from 'rxjs';

import type { NetworkExchange } from '../../access/http/NetworkInspector';
import { useServices } from '../../framework/composition/ServicesProvider';
import { useObservable } from '../hooks/useObservable';
import { AppText, Card, useTheme } from '../theme';
import { DiagnosticsScreen } from './DiagnosticsScreen';

const EMPTY_EXCHANGES: readonly NetworkExchange[] = [];
const EMPTY_EXCHANGES$ = of(EMPTY_EXCHANGES);

/**
 * The dedicated per-request detail page: method, URL, status, duration, and the
 * full request/response headers and payload for one captured exchange, on its own
 * full-screen page rather than a height-capped inline panel. It reads the exchange
 * live, so a pending request fills in when it resolves; sensitive headers were
 * redacted at capture.
 */
export function NetworkDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { networkInspector } = useServices();
  const exchanges = useObservable(
    networkInspector?.exchanges$ ?? EMPTY_EXCHANGES$,
    networkInspector?.getExchanges() ?? EMPTY_EXCHANGES,
  );
  const exchange = exchanges.find((candidate) => candidate.id === id);

  const stateLabel: Record<NetworkExchange['state'], string> = {
    pending: t('diagnostics.network.states.pending'),
    success: t('diagnostics.network.states.success'),
    failure: t('diagnostics.network.states.failure'),
  };

  return (
    <DiagnosticsScreen
      testID="DiagnosticsNetworkDetail"
      title={t('diagnostics.network.detailTitle')}
      onBack={onBack}
    >
      {exchange === undefined ? (
        <View style={{ padding: theme.spacing.lg }}>
          <AppText tone="muted">{t('diagnostics.network.notFound')}</AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
          <Card style={{ gap: theme.spacing.xs }}>
            <Field label={t('diagnostics.network.method')} value={exchange.method} />
            <Field label={t('diagnostics.network.url')} value={exchange.url} />
            <Field label={t('diagnostics.network.state')} value={stateLabel[exchange.state]} />
            <Field
              label={t('diagnostics.network.status')}
              value={exchange.status !== undefined ? String(exchange.status) : '—'}
            />
            <Field
              label={t('diagnostics.network.duration')}
              value={
                exchange.durationMs !== undefined
                  ? t('diagnostics.network.durationValue', { ms: exchange.durationMs })
                  : '—'
              }
            />
            {exchange.errorKind !== undefined && (
              <Field label={t('diagnostics.network.error')} value={exchange.errorKind} />
            )}
          </Card>

          <Section title={t('diagnostics.network.requestHeaders')}>
            <Headers headers={exchange.requestHeaders} />
          </Section>
          <Section title={t('diagnostics.network.requestBody')}>
            <Body body={exchange.requestBody} />
          </Section>
          <Section title={t('diagnostics.network.responseHeaders')}>
            <Headers headers={exchange.responseHeaders} />
          </Section>
          <Section title={t('diagnostics.network.responseBody')}>
            <Body body={exchange.responseBody} />
          </Section>
        </ScrollView>
      )}
    </DiagnosticsScreen>
  );
}

/** A `label: value` line in the general card. */
function Field({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      <AppText variant="caption" tone="muted" style={{ minWidth: 72 }}>
        {label}
      </AppText>
      <AppText variant="caption" style={{ flexShrink: 1 }}>
        {value}
      </AppText>
    </View>
  );
}

/** A titled block (heading over a card) for headers/body. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="heading">{title}</AppText>
      <Card style={{ gap: theme.spacing.xs }}>{children}</Card>
    </View>
  );
}

function Headers({ headers }: { headers?: Readonly<Record<string, string>> }) {
  const { t } = useTranslation();
  const entries = headers ? Object.entries(headers) : [];
  if (entries.length === 0) {
    return (
      <AppText tone="muted" variant="caption">
        {t('diagnostics.network.noHeaders')}
      </AppText>
    );
  }
  return (
    <>
      {entries.map(([key, value]) => (
        <Field key={key} label={key} value={value} />
      ))}
    </>
  );
}

function Body({ body }: { body?: string }) {
  const { t } = useTranslation();
  if (body === undefined || body.length === 0) {
    return (
      <AppText tone="muted" variant="caption">
        {t('diagnostics.network.noBody')}
      </AppText>
    );
  }
  return (
    <AppText variant="caption" selectable>
      {prettyPrint(body)}
    </AppText>
  );
}

/** Pretty-prints a JSON body for readability; leaves non-JSON text untouched. */
function prettyPrint(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
