import { useCallback } from 'react';

import { useServices } from '../../framework/composition/ServicesProvider';

/**
 * Thin binding from the {@link AppReviewService} to React. A screen calls
 * `requestReviewIfAppropriate()` at a **positive moment** (e.g. right after the
 * user submits feedback or completes a flow); the service decides whether the OS
 * prompt is actually appropriate (rate-limited, once per version). Heavy logic
 * stays in Business — this hook only forwards the call.
 */
export function useAppReview() {
  const { appReview } = useServices();

  const requestReviewIfAppropriate = useCallback(
    () => appReview.requestReviewIfAppropriate(),
    [appReview],
  );

  return { requestReviewIfAppropriate };
}
