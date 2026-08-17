import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { isHttpError, NetworkError } from '../../access/http/errors';
import { AppText, Button, Screen, useTheme } from '../theme';

/** The subset of a React Query result this view needs (keeps it easy to test). */
export interface QueryLike<T> {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
  refetch?: () => unknown;
}

interface QueryStateViewProps<T> {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
  /** Optional override for the retry action (defaults to `query.refetch`). */
  onRetry?: () => void;
}

/**
 * The screen-level loading/error convention: given a React Query
 * result, render a spinner while pending, a typed error state on failure
 * (a distinct no-network state vs. a generic error), or the
 * data. Screens wrap their content in this instead of hand-rolling the three
 * states each time.
 */
export function QueryStateView<T>({ query, children, onRetry }: QueryStateViewProps<T>) {
  const theme = useTheme();

  if (query.isPending) {
    return (
      <Screen center>
        <ActivityIndicator testID="QueryLoading" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (query.isError || query.data === undefined) {
    const retry = onRetry ?? (() => query.refetch?.());
    return <ErrorState error={query.error} onRetry={retry} />;
  }

  return <>{children(query.data)}</>;
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isOffline = isHttpError(error) && error instanceof NetworkError;
  const message = isOffline ? t('common.networkError') : t('common.genericError');

  return (
    <Screen center padded testID="QueryError">
      <AppText tone="muted" style={{ textAlign: 'center', marginBottom: theme.spacing.lg }}>
        {message}
      </AppText>
      <Button label={t('common.retry')} onPress={onRetry} />
    </Screen>
  );
}
