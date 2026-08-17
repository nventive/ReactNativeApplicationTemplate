/**
 * The narrow surface of the native Firebase Remote Config SDK the template
 * actually uses. Wrapping the SDK behind this interface keeps
 * {@link FirebaseRemoteConfigProvider} pure and Tier-1 testable (drive it with a
 * fake gateway — no native module), and confines the one SDK import to
 * {@link FirebaseRemoteConfigGateway}. Same pattern as the logging
 * `FileSystemGateway`.
 */
export interface RemoteConfigGateway {
  /**
   * Whether the native module is present and usable. `false` when the optional
   * `@react-native-firebase/remote-config` package is not installed (the default
   * template ships without it) — the provider then serves defaults, exactly like
   * `StaticRemoteConfigProvider`.
   */
  readonly isAvailable: boolean;

  /**
   * Applies in-app defaults and fetch settings (Firebase `setDefaults` +
   * `setConfigSettings`). Called once before the first fetch.
   */
  configure(options: RemoteConfigGatewayOptions): Promise<void>;

  /** Fetches and activates the latest values (Firebase `fetchAndActivate`). */
  fetchAndActivate(): Promise<void>;

  /** The current string value for a key, or `undefined` if unset. */
  getString(key: string): string | undefined;

  /** The current boolean value for a key, or `undefined` if unset. */
  getBoolean(key: string): boolean | undefined;

  /**
   * Subscribes to real-time config updates (Firebase `onConfigUpdated`); the
   * listener runs after the update is activated. Returns an unsubscribe function.
   * A no-op returning a no-op unsubscribe when real-time updates are unsupported.
   */
  onConfigUpdated(listener: () => void): () => void;
}

/** Defaults + fetch settings passed to {@link RemoteConfigGateway.configure}. */
export interface RemoteConfigGatewayOptions {
  /** In-app default values keyed by remote key (Firebase `setDefaults` seed). */
  readonly defaults: Record<string, string | boolean>;
  /** Minimum interval between fetches, in milliseconds. */
  readonly minimumFetchIntervalMillis: number;
  /** Fetch timeout, in milliseconds. */
  readonly fetchTimeoutMillis: number;
}
