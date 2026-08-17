import { useObservableState } from 'observable-hooks';
import type { Observable } from 'rxjs';

/**
 * The single bridge from business-layer RxJS observables to React state.
 *
 * Business services expose live state as an `Observable` backed by a
 * `BehaviorSubject` source of truth (see `src/business/README.md`); this hook
 * is how Presentation subscribes to it. The component re-renders on every
 * emission and unsubscribes automatically on unmount.
 *
 * Convention: subscribe to the service's observable as-is —
 * no clever operator pipelines in the UI. If a stream needs transformation,
 * that logic belongs in the Business service.
 */
export function useObservable<T>(source$: Observable<T>, initialValue: T): T {
  return useObservableState(source$, initialValue);
}
