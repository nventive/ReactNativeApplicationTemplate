import type { TFunction } from 'i18next';
import { z } from 'zod';

/**
 * The example form's validation schema.
 *
 * It is a **builder** that takes `t` so the messages are localized (the
 * `no-literal-string` lint rule stays satisfied and errors follow the app
 * language), following the `react-hook-form` + `zod` idiom. The same `zod` used
 * to parse Access DTOs (`doc/Serialization.md`) validates form input here; the
 * boundary differs (user input, not a network payload), so parsing happens in
 * the UI via `@hookform/resolvers/zod`, not in an Access repository.
 *
 * The inferred {@link FeedbackFormValues} is the form's value type — no separate
 * interface to keep in sync.
 */
export function feedbackFormSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('feedback.errors.nameRequired'))
      .max(80, t('feedback.errors.nameTooLong')),
    email: z.email(t('feedback.errors.emailInvalid')),
    message: z
      .string()
      .trim()
      .min(10, t('feedback.errors.messageTooShort'))
      .max(500, t('feedback.errors.messageTooLong')),
  });
}

export type FeedbackFormValues = z.infer<ReturnType<typeof feedbackFormSchema>>;
