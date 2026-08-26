# Forms & validation

Forms use **[react-hook-form](https://react-hook-form.com/)** driven by a
**[zod](https://zod.dev/)** schema through
**[`@hookform/resolvers/zod`](https://github.com/react-hook-form/resolvers)** —
the app's validation / forms stack. The
same `zod` that parses Access DTOs ([Serialization.md](Serialization.md))
validates user input here; only the boundary differs — form validation runs in
the UI, not in an Access repository.

The canonical example is the **feedback form**
([`FeedbackFormScreen`](../src/presentation/forms/FeedbackFormScreen.tsx)),
presented as a root modal and opened from the Favorites tab header.

## The pattern

**1 — the schema is a builder that takes `t`**, so messages are localized (and the
`no-literal-string` lint rule stays satisfied). The value type is inferred from
the schema — no separate interface to keep in sync.
[`feedbackForm.ts`](../src/presentation/forms/feedbackForm.ts):

```ts
export function feedbackFormSchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(1, t('feedback.errors.nameRequired')).max(80, …),
    email: z.email(t('feedback.errors.emailInvalid')),
    message: z.string().trim().min(10, …).max(500, …),
  });
}
export type FeedbackFormValues = z.infer<ReturnType<typeof feedbackFormSchema>>;
```

**2 — a thin hook wires the schema through the resolver** and keeps the submit side
effect small. [`useFeedbackForm.ts`](../src/presentation/forms/useFeedbackForm.ts):

```ts
const schema = useMemo(() => feedbackFormSchema(t), [t]); // rebuilt on language change
const form = useForm<FeedbackFormValues>({
  resolver: zodResolver(schema),
  defaultValues: { name: '', email: '', message: '' },
  mode: 'onTouched',
});
const submit = form.handleSubmit(async (values) => {
  analytics.trackEvent('feedback_submitted', { messageLength: values.message.length });
  await requestReviewIfAppropriate(); // a positive moment — see AppReviews.md
});
```

There is no backend in the app, so a valid submit reports a domain event
through the [analytics seam](Analytics.md) and treats the completed form as a
positive moment for [app reviews](AppReviews.md). Swap the body for a
Business-service call when a backend exists.

**3 — a `Controller` per field binds the design-system input.** The screen renders
the themed [`TextField`](../src/presentation/theme/TextField.tsx) (label + bordered
input that turns to the error color + message beneath), never a bare `TextInput`:

```tsx
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
    />
  )}
/>
```

## Conventions

- **`TextField` is the form primitive** — a new field type is a new design-system
  component, not inline `TextInput` styling (same rule as the rest of the
  [design system](DesignSystem.md)).
- **Messages are localized** — pass `t('…')` into the schema; add every key to
  both `en.json` and `fr.json`.
- **`zod` is the one validator** — reuse the DTO-parsing idiom; don't hand-roll
  validation in the component.
- **Keep the submit thin** — heavy logic belongs in a Business service, not the
  form hook.

## Testing

Tier 2 — [`FeedbackFormScreen.test.tsx`](../test/presentation/forms/FeedbackFormScreen.test.tsx)
drives the form through RTL: empty/invalid input surfaces per-field messages and
blocks submit; valid input reports the analytics event, asks for a review, and
shows the success state. The submit press is wrapped in `await act(async …)`
because `zod` validation resolves asynchronously before react-hook-form
re-renders.
