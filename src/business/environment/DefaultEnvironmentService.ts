import { BehaviorSubject } from 'rxjs';

import type { KeyValueStore } from '../../access/storage/KeyValueStore';
import {
  isEnvironment,
  ENVIRONMENTS,
  type Environment,
  type EnvironmentConfig,
  type EnvironmentService,
} from './EnvironmentService';
import { ENVIRONMENT_CONFIGS } from './environments';

/** Storage key under which the runtime environment override is persisted. */
export const ENVIRONMENT_OVERRIDE_KEY = 'environment.override';

/**
 * The runtime `EnvironmentService`.
 *
 * At construction it resolves the active environment once — a persisted
 * override if present and valid, otherwise the build default — and seeds
 * `current$`. `setEnvironment` persists an override and marks it pending;
 * applying it requires a restart (the composition root reads the override at
 * startup).
 *
 * Plain TS, no React — fully headless-testable with an `InMemoryKeyValueStore`.
 */
export class DefaultEnvironmentService implements EnvironmentService {
  readonly available = ENVIRONMENTS;

  private readonly _current$: BehaviorSubject<Environment>;
  private readonly _pending$ = new BehaviorSubject<Environment | null>(null);

  readonly current$;
  readonly pending$;

  constructor(
    private readonly store: KeyValueStore,
    private readonly buildDefault: Environment,
  ) {
    const persisted = store.getString(ENVIRONMENT_OVERRIDE_KEY);
    const initial = isEnvironment(persisted) ? persisted : buildDefault;
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
    this.store.setString(ENVIRONMENT_OVERRIDE_KEY, environment);
    this._pending$.next(environment === this.getCurrent() ? null : environment);
    return Promise.resolve();
  }

  reset(): Promise<void> {
    this.store.remove(ENVIRONMENT_OVERRIDE_KEY);
    this._pending$.next(this.buildDefault === this.getCurrent() ? null : this.buildDefault);
    return Promise.resolve();
  }
}
