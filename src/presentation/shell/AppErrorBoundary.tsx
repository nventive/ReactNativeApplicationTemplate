import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Screen, useTheme } from '../theme';

interface Props {
  children: ReactNode;
  /** Called with any render-phase error (the app shell logs it via the `Logger`). */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Custom fallback; defaults to a message + "Try again" that resets the boundary. */
  fallback?: (reset: () => void, error: Error) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-shell React error boundary — catches render-phase crashes anywhere in the
 * tree. It reports the error through
 * `onError` (wired to the `Logger` in `ConnectedErrorBoundary`) and shows a
 * recoverable fallback. Async/fetch errors are React Query's job, not this
 * boundary's — see `QueryStateView`.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private readonly reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (error !== null) {
      return this.props.fallback?.(this.reset, error) ?? <DefaultFallback onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Screen center padded>
      <AppText variant="title" style={{ marginBottom: theme.spacing.sm }}>
        {t('errorBoundary.title')}
      </AppText>
      <AppText tone="muted" style={{ textAlign: 'center', marginBottom: theme.spacing.lg }}>
        {t('errorBoundary.message')}
      </AppText>
      <Button label={t('common.retry')} onPress={onRetry} />
    </Screen>
  );
}
