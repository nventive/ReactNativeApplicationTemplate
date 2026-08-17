import { useNavigation } from '@react-navigation/native';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { AppText, Button, Screen, TextField, useTheme } from '../theme';
import { useFeedbackForm } from './useFeedbackForm';

/**
 * The example form — presented as a modal, it shows
 * the canonical `react-hook-form` + `zod` pattern end to end: a `Controller` per
 * field binding the design-system {@link TextField}, per-field validation
 * messages from the resolver, and a submit that only runs when the schema
 * passes. On success it swaps to a confirmation the user dismisses. All copy is
 * localized and all styling comes from the theme.
 */
export function FeedbackFormScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();
  const { form, submit, isSubmitted } = useFeedbackForm();
  const {
    control,
    formState: { errors },
  } = form;

  if (isSubmitted) {
    return (
      <Screen center padded testID="FeedbackSuccess">
        <AppText variant="title" style={{ marginBottom: theme.spacing.md }}>
          {t('feedback.successTitle')}
        </AppText>
        <AppText tone="muted" style={{ textAlign: 'center', marginBottom: theme.spacing.lg }}>
          {t('feedback.successBody')}
        </AppText>
        <Button label={t('feedback.close')} onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen padded testID="FeedbackForm">
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText tone="muted">{t('feedback.intro')}</AppText>

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField
              testID="FeedbackName"
              label={t('feedback.name')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.name?.message}
              autoCapitalize="words"
              autoComplete="name"
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              testID="FeedbackEmail"
              label={t('feedback.email')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          )}
        />

        <Controller
          control={control}
          name="message"
          render={({ field }) => (
            <TextField
              testID="FeedbackMessage"
              label={t('feedback.message')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.message?.message}
              multiline
              numberOfLines={4}
              style={{ minHeight: theme.spacing.xxl * 3, textAlignVertical: 'top' }}
            />
          )}
        />

        <Button
          testID="FeedbackSubmit"
          label={t('feedback.submit')}
          onPress={() => void submit()}
        />
      </ScrollView>
    </Screen>
  );
}
