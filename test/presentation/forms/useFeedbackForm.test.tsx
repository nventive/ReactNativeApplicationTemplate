/**
 * Tier 2 — React runtime, headless. Exercises the form hook's submit behavior by
 * driving react-hook-form directly and **awaiting the submit promise inside
 * `act`**, which settles the async zod resolver deterministically (no
 * button-press fire-and-forget, so no stray updates escape the test). Asserts the
 * valid path reports the analytics event, asks for a review, and marks the form
 * submitted; the invalid path does none of that and surfaces field errors.
 */
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

// Side-effect import: initialize i18n so useTranslation returns real strings.
import '../../../src/framework/i18n';
import { RecordingAnalyticsSink } from '../../../src/access/analytics/RecordingAnalyticsSink';
import type { AppReviewService } from '../../../src/business/appReview/AppReviewService';
import { createServices } from '../../../src/framework/composition/createServices';
import { ServicesProvider } from '../../../src/framework/composition/ServicesProvider';
import { useFeedbackForm } from '../../../src/presentation/forms/useFeedbackForm';

function createHarness() {
  const analytics = new RecordingAnalyticsSink();
  const requestReviewIfAppropriate = jest.fn<Promise<boolean>, []>(() => Promise.resolve(true));
  const appReview: AppReviewService = { requestReviewIfAppropriate };
  const services = createServices({ analytics, appReview });
  function Wrapper({ children }: { children: ReactNode }) {
    return <ServicesProvider services={services}>{children}</ServicesProvider>;
  }
  return { Wrapper, analytics, requestReviewIfAppropriate };
}

describe('useFeedbackForm', () => {
  it('submits valid input: records the event, asks for a review, marks submitted', async () => {
    const { Wrapper, analytics, requestReviewIfAppropriate } = createHarness();
    const { result } = await renderHook(() => useFeedbackForm(), { wrapper: Wrapper });

    await act(async () => {
      result.current.form.setValue('name', 'Jordan');
      result.current.form.setValue('email', 'jordan@example.com');
      result.current.form.setValue('message', 'This is a long enough message.');
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(requestReviewIfAppropriate).toHaveBeenCalledTimes(1);
    expect(analytics.recordsOf('event')).toEqual([
      { type: 'event', name: 'feedback_submitted', data: { messageLength: 30 } },
    ]);
    expect(result.current.isSubmitted).toBe(true);
  });

  it('blocks invalid input: no event, no review, surfaces field errors', async () => {
    const { Wrapper, analytics, requestReviewIfAppropriate } = createHarness();
    const { result } = await renderHook(() => useFeedbackForm(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.submit();
    });

    expect(requestReviewIfAppropriate).not.toHaveBeenCalled();
    expect(analytics.recordsOf('event')).toHaveLength(0);
    expect(result.current.isSubmitted).toBe(false);
    expect(result.current.form.formState.errors.name?.message).toBe('Please enter your name.');
    expect(result.current.form.formState.errors.email?.message).toBe(
      'Please enter a valid email address.',
    );
  });
});
