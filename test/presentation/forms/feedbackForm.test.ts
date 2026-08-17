/**
 * Tier 1 — plain TS, no React. Validates the feedback form's zod schema directly
 * (the same idiom used for Access DTOs), so the validation rules and localized
 * messages are proven without rendering. `t` is faked to echo the key, so each
 * assertion pins the exact message key the field uses.
 */
import type { TFunction } from 'i18next';

import { feedbackFormSchema } from '../../../src/presentation/forms/feedbackForm';

const t = ((key: string) => key) as unknown as TFunction;
const schema = feedbackFormSchema(t);

const validInput = {
  name: 'Jordan',
  email: 'jordan@example.com',
  message: 'This is a long enough message.',
};

/** Maps a failed parse to `{ field: messageKey }` for concise assertions. */
function errorsByField(input: unknown): Record<string, string> {
  const result = schema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  );
}

describe('feedbackFormSchema', () => {
  it('accepts valid input and trims whitespace', () => {
    const result = schema.safeParse({ ...validInput, name: '  Jordan  ' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.name).toBe('Jordan');
  });

  it('flags an empty name', () => {
    expect(errorsByField({ ...validInput, name: '   ' })).toEqual({
      name: 'feedback.errors.nameRequired',
    });
  });

  it('flags an invalid email', () => {
    expect(errorsByField({ ...validInput, email: 'not-an-email' })).toEqual({
      email: 'feedback.errors.emailInvalid',
    });
  });

  it('flags a too-short message', () => {
    expect(errorsByField({ ...validInput, message: 'too short' })).toEqual({
      message: 'feedback.errors.messageTooShort',
    });
  });

  it('flags over-long fields', () => {
    const errors = errorsByField({
      name: 'x'.repeat(81),
      email: 'jordan@example.com',
      message: 'y'.repeat(501),
    });

    expect(errors).toEqual({
      name: 'feedback.errors.nameTooLong',
      message: 'feedback.errors.messageTooLong',
    });
  });

  it('reports every invalid field at once', () => {
    expect(errorsByField({ name: '', email: 'bad', message: 'x' })).toEqual({
      name: 'feedback.errors.nameRequired',
      email: 'feedback.errors.emailInvalid',
      message: 'feedback.errors.messageTooShort',
    });
  });
});
