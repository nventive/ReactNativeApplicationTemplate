import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useServices } from '../../framework/composition/ServicesProvider';
import { useAppReview } from '../appReview/useAppReview';
import { feedbackFormSchema, type FeedbackFormValues } from './feedbackForm';

/**
 * The example form binding — `react-hook-form` driven by the `zod` resolver.
 * It is the template's canonical form pattern: build the localized
 * schema once, wire it through `zodResolver`, and keep the submit side effect
 * thin. There is no backend in the template, so a valid submit reports a domain
 * event through the analytics seam and treats the completed form as a **positive
 * moment** — asking the (rate-limited) store-review prompt. Swap the body for a
 * real Business-service call when a backend exists.
 */
export function useFeedbackForm() {
  const { t } = useTranslation();
  const { analytics } = useServices();
  const { requestReviewIfAppropriate } = useAppReview();

  // Rebuilt only when the language changes, so validation messages track it.
  const schema = useMemo(() => feedbackFormSchema(t), [t]);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', message: '' },
    mode: 'onTouched',
  });

  const submit = form.handleSubmit(async (values) => {
    analytics.trackEvent('feedback_submitted', { messageLength: values.message.length });
    await requestReviewIfAppropriate();
  });

  return { form, submit, isSubmitted: form.formState.isSubmitSuccessful };
}
