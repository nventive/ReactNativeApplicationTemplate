import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, Card, useTheme } from '../theme';

/**
 * A titled block inside the diagnostics panel — a small presentational wrapper
 * so every section (environment, logs, mocking, remote config) reads the same:
 * a heading over a themed {@link Card}. The `title` is passed already-localized
 * by the caller.
 */
export function DiagnosticsSection({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <AppText variant="heading" style={{ marginBottom: theme.spacing.sm }}>
        {title}
      </AppText>
      <Card style={{ gap: theme.spacing.sm }}>{children}</Card>
    </View>
  );
}
