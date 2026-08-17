import type { Observable } from 'rxjs';

import type { LogLevel } from '../../access/logger/LogLevel';

/**
 * The selectable runtime environments (`development` / `staging` / `production`).
 */
export type Environment = 'development' | 'staging' | 'production';

/** Ordered list of every selectable environment. */
export const ENVIRONMENTS: readonly Environment[] = ['development', 'staging', 'production'];

/** Runtime type guard for a persisted / configured environment string. */
export function isEnvironment(value: unknown): value is Environment {
  return typeof value === 'string' && (ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Every per-environment value features may read. A typed, per-environment
 * config — type-safe rather than stringly-typed. Extend it as features are added
 * (each new per-env value gets a field here).
 */
export interface EnvironmentConfig {
  readonly name: Environment;
  /** Human-readable label for the diagnostics picker (`Development` / …). */
  readonly label: string;
  /** Base URL features build API calls from (consumed by the HTTP client). */
  readonly apiBaseUrl: string;
  /** Whether the diagnostics overlay is enabled in this environment. */
  readonly diagnosticsEnabled: boolean;
  /**
   * Whether crash & session reporting (Bugsee) may run in this environment.
   * **Internal/dev distribution only — never production**, because Bugsee is
   * billed per user, so it is only worth running on internal builds. Combined
   * with a valid build-time token at the composition root: no token ⇒ still off.
   * See `doc/CrashReporting.md`.
   */
  readonly crashReportingEnabled: boolean;
  /** Logging configuration the composition root uses to build the `Logger`. */
  readonly logging: {
    readonly console: boolean;
    readonly file: boolean;
    readonly minimumLevel: LogLevel;
  };
  /** Firebase Remote Config tuning (only consulted when the real provider is wired). */
  readonly remoteConfig: {
    /**
     * Minimum interval between remote fetches (Firebase `minimumFetchInterval`).
     * Short in dev/staging for fast iteration, long in production to respect
     * quotas.
     */
    readonly fetchIntervalMinutes: number;
  };
  /** Store URLs the forced-update feature redirects to (per platform). */
  readonly appStoreUrl: {
    readonly ios: string;
    readonly android: string;
  };
}

/**
 * Runtime environment access — the one thing features consume for environment
 * values (never `app.config.ts` / expo-constants directly; by convention).
 *
 * Switching is restart-to-apply (`current` + `next`): `setEnvironment` persists
 * an override and marks it pending, but the active environment and the wired
 * services graph do not change mid-session — the composition root reads the
 * persisted override once at startup. See `doc/Environment.md`.
 */
export interface EnvironmentService {
  /** Every selectable environment (drives the diagnostics picker). */
  readonly available: readonly Environment[];

  /** The active environment for this session. `BehaviorSubject` source of truth. */
  readonly current$: Observable<Environment>;

  /**
   * The environment that will be active after the next restart, or `null` when
   * that equals the current one (nothing pending). Drives the picker's
   * "restart to apply" banner.
   */
  readonly pending$: Observable<Environment | null>;

  /** Synchronous snapshot of the active environment (for the composition root). */
  getCurrent(): Environment;

  /** Resolved config for the active environment — what features read. */
  getConfig(): EnvironmentConfig;

  /**
   * Persists an override to apply on next launch and marks it pending. Does not
   * change the active environment.
   */
  setEnvironment(environment: Environment): Promise<void>;

  /** Clears the override; the next launch reverts to the build default. */
  reset(): Promise<void>;
}
