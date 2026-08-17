import { type ErrorInfo, type ReactNode, useCallback } from 'react';

import { useServices } from '../../framework/composition/ServicesProvider';
import { AppErrorBoundary } from './AppErrorBoundary';

/**
 * `AppErrorBoundary` wired to the composition root's `Logger` and
 * `CrashReporter`: render-phase crashes are logged at `fatal` and reported to the
 * crash reporter (a no-op on
 * production/store builds) before the fallback shows. Placed just inside
 * `ServicesProvider` so it can reach services via `useServices`.
 */
export function ConnectedErrorBoundary({ children }: { children: ReactNode }) {
  const { logger, crashReporter } = useServices();

  const onError = useCallback(
    (error: Error, info: ErrorInfo) => {
      logger.fatal('Unhandled UI error', error, { componentStack: info.componentStack });
      crashReporter.recordError(error, { componentStack: info.componentStack });
    },
    [logger, crashReporter],
  );

  return <AppErrorBoundary onError={onError}>{children}</AppErrorBoundary>;
}
