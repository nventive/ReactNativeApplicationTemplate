import type { RemoteConfigGateway, RemoteConfigGatewayOptions } from './RemoteConfigGateway';

/**
 * The minimal slice of the `@react-native-firebase/remote-config` instance API
 * this gateway calls. Typed locally (rather than against the package) so the
 * template typechecks and tests without the optional SDK installed; the real
 * module satisfies this shape at runtime once a project adds Firebase.
 */
interface FirebaseRemoteConfigInstance {
  setDefaults(defaults: Record<string, string | number | boolean>): Promise<unknown>;
  setConfigSettings(settings: {
    minimumFetchIntervalMillis: number;
    fetchTimeMillis: number;
  }): Promise<unknown>;
  fetchAndActivate(): Promise<boolean>;
  activate(): Promise<boolean>;
  getValue(key: string): { asString(): string; asBoolean(): boolean };
  onConfigUpdated(listener: (event: unknown, error: unknown) => void): () => void;
}

type FirebaseRemoteConfigModule = {
  default?: () => FirebaseRemoteConfigInstance;
} & (() => FirebaseRemoteConfigInstance);

/**
 * Loads the optional Firebase Remote Config SDK, or `undefined` when it is not
 * installed. The `require` is a **literal** so Metro bundles the module once a
 * project installs it; the `try/catch` keeps the default template (which ships
 * without the package) from crashing. This file is imported only from the opt-in
 * wiring path, so the default bundle never references the absent module.
 */
function loadFirebaseRemoteConfig(): FirebaseRemoteConfigInstance | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/remote-config') as FirebaseRemoteConfigModule;
    const factory = mod.default ?? mod;
    return typeof factory === 'function' ? factory() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The real {@link RemoteConfigGateway}, backed by
 * `@react-native-firebase/remote-config`. This is the **only** file that touches
 * the Firebase SDK.
 *
 * Firebase is an **opt-in** platform integration: the package is not a default
 * dependency (keeping the public template free of vendor SDKs and its native
 * build green), so the SDK is loaded lazily above. When it is absent,
 * {@link isAvailable} is `false` and the composition root falls back to
 * `StaticRemoteConfigProvider`. A project activates Firebase by installing the
 * packages and wiring `createFirebaseRemoteConfigProvider` — see
 * `doc/FirebaseRemoteConfig.md`.
 */
export class FirebaseRemoteConfigGateway implements RemoteConfigGateway {
  private readonly instance = loadFirebaseRemoteConfig();

  get isAvailable(): boolean {
    return this.instance !== undefined;
  }

  async configure(options: RemoteConfigGatewayOptions): Promise<void> {
    if (!this.instance) return;
    await this.instance.setConfigSettings({
      minimumFetchIntervalMillis: options.minimumFetchIntervalMillis,
      fetchTimeMillis: options.fetchTimeoutMillis,
    });
    await this.instance.setDefaults(options.defaults);
  }

  async fetchAndActivate(): Promise<void> {
    if (!this.instance) return;
    await this.instance.fetchAndActivate();
  }

  getString(key: string): string | undefined {
    return this.instance?.getValue(key).asString();
  }

  getBoolean(key: string): boolean | undefined {
    return this.instance?.getValue(key).asBoolean();
  }

  onConfigUpdated(listener: () => void): () => void {
    const instance = this.instance;
    if (!instance) return () => {};
    // Real-time updates arrive un-activated; activate, then notify the provider
    // to re-read. Swallow activation errors — the next fetch recovers.
    return instance.onConfigUpdated(() => {
      instance.activate().then(listener, listener);
    });
  }
}
