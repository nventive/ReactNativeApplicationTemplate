import { BehaviorSubject } from 'rxjs';

import {
  ENVIRONMENTS,
  type Environment,
  type EnvironmentConfig,
  type EnvironmentService,
} from './EnvironmentService';
import { ENVIRONMENT_CONFIGS } from './environments';

/**
 * In-memory `EnvironmentService` with no persistence, for Tier-1 tests of
 * consumers (HTTP client, features) that just need a fixed environment. Its
 * `setEnvironment`/`reset` update `pending$` like the real service but never
 * touch storage.
 */
export class MockEnvironmentService implements EnvironmentService {
  readonly available = ENVIRONMENTS;

  private readonly _current$: BehaviorSubject<Environment>;
  private readonly _pending$ = new BehaviorSubject<Environment | null>(null);

  readonly current$;
  readonly pending$;

  constructor(initial: Environment = 'development') {
    this._current$ = new BehaviorSubject<Environment>(initial);
    this.current$ = this._current$.asObservable();
    this.pending$ = this._pending$.asObservable();
  }

  getCurrent(): Environment {
    return this._current$.getValue();
  }

  getConfig(): EnvironmentConfig {
    return ENVIRONMENT_CONFIGS[this.getCurrent()];
  }

  setEnvironment(environment: Environment): Promise<void> {
    this._pending$.next(environment === this.getCurrent() ? null : environment);
    return Promise.resolve();
  }

  reset(): Promise<void> {
    this._pending$.next(null);
    return Promise.resolve();
  }
}
