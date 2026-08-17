import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, useTheme } from '../theme';

/**
 * Full-screen chrome shared by every diagnostics overlay page (the panel and its
 * dedicated sub-pages). It renders as an `absoluteFill` layer above the app with
 * a header — an optional **Back** button, the title, and a right-side slot (a
 * custom action, or a **Close** button) — over a flexible body the caller fills
 * with its own scroll view or list.
 *
 * The diagnostics overlay lives outside the React Navigation tree (mounted
 * outside `AppGate` so it stays reachable during a block), so navigation between
 * pages is a small state machine in `DiagnosticsHost`, not routes — this is the
 * shared page frame that makes those pages look consistent.
 */
export function DiagnosticsScreen({
  title,
  testID,
  onBack,
  onClose,
  right,
  children,
}: {
  title: string;
  testID?: string;
  onBack?: () => void;
  onClose?: () => void;
  right?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: theme.colors.background, paddingTop: insets.top },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flexShrink: 1,
          }}
        >
          {onBack && (
            <Button
              testID="DiagnosticsBack"
              variant="outline"
              label={t('diagnostics.back')}
              onPress={onBack}
            />
          )}
          <AppText variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </AppText>
        </View>
        {right ??
          (onClose && (
            <Button
              testID="DiagnosticsClose"
              variant="outline"
              label={t('diagnostics.close')}
              onPress={onClose}
            />
          ))}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
