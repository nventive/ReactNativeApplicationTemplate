import type { AxiosInstance } from 'axios';

import type { AnalyticsSink } from '../../access/analytics/AnalyticsSink';
import { LoggingAnalyticsSink } from '../../access/analytics/LoggingAnalyticsSink';
import type { AppInfoRepository } from '../../access/appInfo/AppInfoRepository';
import { ExpoAppInfoRepository } from '../../access/appInfo/ExpoAppInfoRepository';
import type { CurrentVersionRepository } from '../../access/appInfo/CurrentVersionRepository';
import type { AppReviewGateway } from '../../access/appReview/AppReviewGateway';
import { ExpoStoreReviewGateway } from '../../access/appReview/ExpoStoreReviewGateway';
import { InMemoryAppReviewGateway } from '../../access/appReview/InMemoryAppReviewGateway';
import type { CrashReporter } from '../../access/crashReporting/CrashReporter';
import { NoopCrashReporter } from '../../access/crashReporting/NoopCrashReporter';
import { ExpoCurrentVersionRepository } from '../../access/appInfo/ExpoCurrentVersionRepository';
import { createHttpClient } from '../../access/http/createHttpClient';
import {
  InMemoryNetworkInspector,
  type NetworkInspector,
  type NetworkRecorder,
} from '../../access/http/NetworkInspector';
import { MockTokenProvider } from '../../access/http/TokenProvider';
import { HttpJokesRepository } from '../../access/jokes/HttpJokesRepository';
import { MockJokesRepository } from '../../access/jokes/MockJokesRepository';
import type { JokesRepository } from '../../access/jokes/JokesRepository';
import { CompositeLogger } from '../../access/logger/CompositeLogger';
import { ConsoleTransport } from '../../access/logger/ConsoleTransport';
import { ExpoFileSystemGateway } from '../../access/logger/ExpoFileSystemGateway';
import type { FileSystemGateway } from '../../access/logger/FileSystemGateway';
import { FileTransport } from '../../access/logger/FileTransport';
import { InMemoryLogTransport } from '../../access/logger/InMemoryLogTransport';
import type { Logger, LogBufferReader, LogFileReader } from '../../access/logger/Logger';
import type { LogTransport } from '../../access/logger/LogTransport';
import { ExpoFileSharer } from '../../access/native/ExpoFileSharer';
import type { FileSharer } from '../../access/native/FileSharer';
import { LinkingUrlLauncher } from '../../access/native/LinkingUrlLauncher';
import type { UrlLauncher } from '../../access/native/UrlLauncher';
import { MockRemoteConfigProvider } from '../../access/remoteConfig/MockRemoteConfigProvider';
import {
  isRemoteConfigController,
  type RemoteConfigController,
  type RemoteConfigProvider,
} from '../../access/remoteConfig/RemoteConfigProvider';
import { StaticRemoteConfigProvider } from '../../access/remoteConfig/StaticRemoteConfigProvider';
import { ExpoSecureStore } from '../../access/storage/ExpoSecureStore';
import type { KeyValueStore } from '../../access/storage/KeyValueStore';
import { MmkvKeyValueStore } from '../../access/storage/MmkvKeyValueStore';
import type { SecureStore } from '../../access/storage/SecureStore';
import { DefaultAppReviewService } from '../../business/appReview/DefaultAppReviewService';
import type { AppReviewService } from '../../business/appReview/AppReviewService';
import { DefaultDiagnosticsService } from '../../business/diagnostics/DefaultDiagnosticsService';
import type { DiagnosticsService } from '../../business/diagnostics/DiagnosticsService';
import { DefaultEnvironmentService } from '../../business/environment/DefaultEnvironmentService';
import type {
  EnvironmentConfig,
  EnvironmentService,
} from '../../business/environment/EnvironmentService';
import { DefaultForcedUpdateService } from '../../business/forcedUpdate/DefaultForcedUpdateService';
import type { ForcedUpdateService } from '../../business/forcedUpdate/ForcedUpdateService';
import { DefaultJokesService } from '../../business/jokes/DefaultJokesService';
import type { JokesService } from '../../business/jokes/JokesService';
import { DefaultKillSwitchService } from '../../business/killSwitch/DefaultKillSwitchService';
import type { KillSwitchService } from '../../business/killSwitch/KillSwitchService';
import {
  DefaultLoggingService,
  resolveLoggingSettings,
} from '../../business/logging/DefaultLoggingService';
import type { LoggingService, LoggingSettings } from '../../business/logging/LoggingService';
import {
  DefaultMockingService,
  resolveMockingEnabled,
} from '../../business/mocking/DefaultMockingService';
import type { MockingService } from '../../business/mocking/MockingService';
import { getBuildDefaultEnvironment } from '../config/appEnvironment';

/**
 * The full service graph, exposed to consumers as interfaces only.
 * Presentation reaches it through `useServices()` (see ServicesProvider.tsx).
 */
export interface Services {
  /** Cross-cutting logger (console/file/in-memory transports per environment). */
  readonly logger: Logger;
  /** Retrieval surface for the file log (diagnostics viewer); null with no file transport. */
  readonly logReader: LogFileReader | null;
  /**
   * Live in-memory log buffer backing the in-app log console + network inspector;
   * null where diagnostics is off (production) or a `logger` override is supplied.
   */
  readonly logBuffer: LogBufferReader | null;
  /** Runtime console/file logging toggles (persisted, applied on restart). */
  readonly logging: LoggingService;
  /**
   * In-app HTTP inspector store (captured request/response detail: headers,
   * payload, timing); null where diagnostics is off (production).
   */
  readonly networkInspector: NetworkInspector | null;
  /** Analytics seam — screen views + domain events (no-op logging sink by default). */
  readonly analytics: AnalyticsSink;
  /**
   * Crash & session reporting seam. `NoopCrashReporter` by default (production /
   * store builds carry no reporting SDK); a project wires the Bugsee reporter for
   * internal builds via {@link ServiceOverrides.crashReporterFactory}.
   */
  readonly crashReporter: CrashReporter;
  /** Runtime environment (current + config + switch-on-restart). */
  readonly environment: EnvironmentService;
  /** OS keychain-backed store for secrets; seam ready for auth features. */
  readonly secureStore: SecureStore;
  /** Opens external URLs (store pages) — used by the forced-update screen. */
  readonly urlLauncher: UrlLauncher;
  /** Shares on-disk files through the OS share sheet — used by the log viewer. */
  readonly fileSharer: FileSharer;
  /** Remote configuration (minimum version + kill flag) driving the operational features. */
  readonly remoteConfig: RemoteConfigProvider;
  /**
   * Mock remote-config controls, exposed **only when mocking is active** so the
   * diagnostics overlay can force an update / toggle the kill switch. Null with
   * the real (or static) provider.
   */
  readonly remoteConfigController: RemoteConfigController | null;
  /** Forced-update gate state (installed version vs. remote minimum). */
  readonly forcedUpdate: ForcedUpdateService;
  /** Kill-switch gate state (remote flag). */
  readonly killSwitch: KillSwitchService;
  /** App identity for display (name, version, build number) — shown in diagnostics. */
  readonly appInfo: AppInfoRepository;
  /** Diagnostics overlay availability + dismissal. */
  readonly diagnostics: DiagnosticsService;
  /** Runtime real-vs-mock data-source toggle (applied on restart). */
  readonly mocking: MockingService;
  /** In-app store review — prompt (rate-limited) at positive moments. */
  readonly appReview: AppReviewService;
  readonly jokes: JokesService;
}

/**
 * Partial overrides so tests can swap any node of the graph, e.g.
 * `createServices({ keyValueStore: new InMemoryKeyValueStore() })`.
 * Overriding a leaf rebuilds everything above it with the override in place;
 * overriding a service replaces that node wholesale.
 */
export interface ServiceOverrides {
  keyValueStore?: KeyValueStore;
  secureStore?: SecureStore;
  fileSystem?: FileSystemGateway;
  logger?: Logger;
  logging?: LoggingService;
  analytics?: AnalyticsSink;
  crashReporter?: CrashReporter;
  /**
   * Opt-in factory for the crash reporter, receiving the resolved logger + env
   * config. The app entry passes `bugseeCrashReporterFactory` (from
   * `platformIntegrations`) to activate Bugsee on internal builds; omitted, the
   * reporter defaults to `NoopCrashReporter`. Ignored when `crashReporter` is set.
   */
  crashReporterFactory?: (deps: { logger: Logger; config: EnvironmentConfig }) => CrashReporter;
  environment?: EnvironmentService;
  urlLauncher?: UrlLauncher;
  fileSharer?: FileSharer;
  /** The shared axios instance real repositories fetch through. */
  httpClient?: AxiosInstance;
  /** In-app network inspector store (also the HTTP client's capture recorder). */
  networkInspector?: NetworkInspector & NetworkRecorder;
  jokesRepository?: JokesRepository;
  jokes?: JokesService;
  remoteConfig?: RemoteConfigProvider;
  /**
   * Opt-in factory for the non-mock remote-config provider, receiving the
   * resolved logger + env config. The app entry passes `firebaseRemoteConfigFactory`
   * (from `platformIntegrations`) to activate Firebase Remote Config; omitted, the
   * non-mock path uses `StaticRemoteConfigProvider`. Ignored when mocking is on
   * (the mock provider drives the diagnostics triggers) or `remoteConfig` is set.
   */
  remoteConfigFactory?: (deps: {
    logger: Logger;
    config: EnvironmentConfig;
  }) => RemoteConfigProvider;
  currentVersionRepository?: CurrentVersionRepository;
  appInfo?: AppInfoRepository;
  forcedUpdate?: ForcedUpdateService;
  killSwitch?: KillSwitchService;
  diagnostics?: DiagnosticsService;
  mocking?: MockingService;
  appReviewGateway?: AppReviewGateway;
  appReview?: AppReviewService;
  /** Forces the real-vs-mock decision, bypassing the persisted flag / env default. */
  mockingEnabled?: boolean;
}

/**
 * The composition root — the ONLY place the object graph is assembled.
 *
 * Plain constructor calls — no DI container, no decorators. The whole graph is
 * readable top to bottom, and "add a service" stays a one-file, reviewable diff.
 *
 * This module is plain TS with no React import — it must stay buildable in Node
 * so Tier-1 tests can boot the whole graph headlessly. The default native-backed
 * leaves (MMKV, expo-secure-store, expo-file-system, expo-constants, Linking)
 * resolve to their Jest mocks under test; Tier-1 tests that assert
 * storage/logging behavior inject the in-memory implementations through the
 * overrides above.
 */
export function createServices(overrides: ServiceOverrides = {}): Services {
  // Access — storage.
  const keyValueStore = overrides.keyValueStore ?? new MmkvKeyValueStore();
  const secureStore = overrides.secureStore ?? new ExpoSecureStore();

  // Business — environment. Resolved once here (build default + persisted
  // override); the rest of the graph is wired from its config.
  const environment =
    overrides.environment ??
    new DefaultEnvironmentService(keyValueStore, getBuildDefaultEnvironment());
  const environmentConfig = environment.getConfig();

  // Business — logging toggles. The effective console/file selection is resolved
  // once here (persisted override, else the environment defaults) and drives which
  // transports the logger is built with; changing a toggle needs a restart.
  const loggingSettings = resolveLoggingSettings(keyValueStore, environmentConfig);
  const logging = overrides.logging ?? new DefaultLoggingService(keyValueStore, loggingSettings);

  // Access — logging. Transports are chosen from the resolved settings; the file
  // transport (if any) doubles as the diagnostics log reader, and the in-memory
  // buffer (present when diagnostics is enabled) backs the in-app log console.
  const fileSystem = overrides.fileSystem ?? new ExpoFileSystemGateway();
  const built = buildLogger(environmentConfig, fileSystem, loggingSettings);
  const logger = overrides.logger ?? built.logger;
  const logReader = overrides.logger ? null : built.logReader;
  const logBuffer = overrides.logger ? null : built.logBuffer;

  // Access — analytics seam. Default sink just logs (visibility, no backend).
  const analytics = overrides.analytics ?? new LoggingAnalyticsSink(logger);

  // Access — crash & session reporting seam. No-op by default (production / store
  // builds ship no reporting SDK); the app entry passes a `crashReporterFactory`
  // to activate Bugsee on internal builds. The factory itself enforces
  // "internal-only + valid token"; see `platformIntegrations`.
  const crashReporter =
    overrides.crashReporter ??
    overrides.crashReporterFactory?.({ logger, config: environmentConfig }) ??
    new NoopCrashReporter(logger);
  crashReporter.setAttribute('environment', environment.getCurrent());

  // Access — external URL opening (store pages for forced update) and file
  // sharing (the log file for the diagnostics viewer).
  const urlLauncher = overrides.urlLauncher ?? new LinkingUrlLauncher();
  const fileSharer = overrides.fileSharer ?? new ExpoFileSharer();

  // Business — mocking toggle. The effective flag is resolved once here
  // (persisted override, else "mocks in development") and drives which Access
  // implementations the graph is wired with. Applying a change needs a restart.
  const mockingEnabled =
    overrides.mockingEnabled ?? resolveMockingEnabled(keyValueStore, environment.getCurrent());
  const mocking = overrides.mocking ?? new DefaultMockingService(keyValueStore, mockingEnabled);

  // Access — the in-app network inspector store. Built only when diagnostics is
  // enabled (headers/bodies are captured in memory, so it is zero-cost in
  // production), and wired into the HTTP client as the capture recorder.
  const networkInspector: (NetworkInspector & NetworkRecorder) | null =
    overrides.networkInspector ??
    (environmentConfig.diagnosticsEnabled ? new InMemoryNetworkInspector() : null);

  // Access — the shared HTTP client every real repository fetches through. Base
  // URL comes from the active environment; a no-auth token provider is wired
  // until an auth feature lands (see `doc/HTTP.md`).
  const httpClient =
    overrides.httpClient ??
    createHttpClient({
      baseUrl: environmentConfig.apiBaseUrl,
      logger,
      tokenProvider: new MockTokenProvider(),
      networkRecorder: networkInspector ?? undefined,
    });

  // Access + Business — the Dad Jokes feature. Mock repository when mocking is
  // active (dev default, or the persisted toggle); the real HTTP repository
  // otherwise.
  const jokesRepository =
    overrides.jokesRepository ??
    (mockingEnabled ? new MockJokesRepository() : new HttpJokesRepository(httpClient));
  const jokes =
    overrides.jokes ?? new DefaultJokesService(jokesRepository, keyValueStore, logger, analytics);

  // Access — remote config. The controllable mock when mocking is active (its
  // controls light up the diagnostics trigger buttons); otherwise the Firebase
  // provider when the app entry wired one, else the static defaults
  // provider (no backend).
  const { remoteConfig, remoteConfigController } = resolveRemoteConfig(overrides, mockingEnabled, {
    logger,
    config: environmentConfig,
  });

  // Access — app identity for display (name / version / build number), read from
  // the native binary via expo-application (config fallback); shown in diagnostics.
  const appInfo = overrides.appInfo ?? new ExpoAppInfoRepository();

  // Business — the operational gates built on remote config + the installed version.
  const currentVersionRepository =
    overrides.currentVersionRepository ?? new ExpoCurrentVersionRepository();
  const forcedUpdate =
    overrides.forcedUpdate ??
    new DefaultForcedUpdateService(remoteConfig, currentVersionRepository);
  const killSwitch = overrides.killSwitch ?? new DefaultKillSwitchService(remoteConfig);

  // Business — diagnostics overlay availability (off in production, matching the env config).
  const diagnostics =
    overrides.diagnostics ??
    new DefaultDiagnosticsService(keyValueStore, environmentConfig.diagnosticsEnabled);

  // Access + Business — in-app store review. The in-memory gateway when mocking is
  // active (keeps fully-offline runs from touching native), the real
  // expo-store-review gateway otherwise; the service holds the once-per-version +
  // signal-threshold policy.
  const appReviewGateway =
    overrides.appReviewGateway ??
    (mockingEnabled ? new InMemoryAppReviewGateway() : new ExpoStoreReviewGateway());
  const appReview =
    overrides.appReview ??
    new DefaultAppReviewService(appReviewGateway, keyValueStore, currentVersionRepository, logger);

  return {
    logger,
    logReader,
    logBuffer,
    logging,
    networkInspector,
    analytics,
    crashReporter,
    environment,
    secureStore,
    urlLauncher,
    fileSharer,
    remoteConfig,
    remoteConfigController,
    appInfo,
    forcedUpdate,
    killSwitch,
    diagnostics,
    mocking,
    appReview,
    jokes,
  };
}

/**
 * Chooses the remote-config provider and, when it is controllable, its control
 * surface. Precedence: an overridden provider is used as-is (its controls exposed
 * if it has them, so tests can drive it); otherwise the mock when mocking is
 * active (its controls light up the diagnostics triggers); otherwise the wired
 * Firebase provider when the app entry supplied a factory; else the
 * static defaults provider.
 */
function resolveRemoteConfig(
  overrides: ServiceOverrides,
  mockingEnabled: boolean,
  deps: { logger: Logger; config: EnvironmentConfig },
): { remoteConfig: RemoteConfigProvider; remoteConfigController: RemoteConfigController | null } {
  if (overrides.remoteConfig) {
    const remoteConfig = overrides.remoteConfig;
    return {
      remoteConfig,
      remoteConfigController: isRemoteConfigController(remoteConfig) ? remoteConfig : null,
    };
  }
  if (mockingEnabled) {
    const mock = new MockRemoteConfigProvider();
    return { remoteConfig: mock, remoteConfigController: mock };
  }
  if (overrides.remoteConfigFactory) {
    const remoteConfig = overrides.remoteConfigFactory(deps);
    return {
      remoteConfig,
      remoteConfigController: isRemoteConfigController(remoteConfig) ? remoteConfig : null,
    };
  }
  return { remoteConfig: new StaticRemoteConfigProvider(), remoteConfigController: null };
}

/**
 * Builds the app logger. Which sinks attach comes from the resolved logging
 * `settings` (persisted overrides over the environment defaults); the minimum
 * level stays an environment concern. The in-memory buffer that backs the in-app
 * console is attached whenever diagnostics is enabled — independent of the
 * console/file toggles, so the console keeps working even with both sinks off.
 */
function buildLogger(
  config: EnvironmentConfig,
  fileSystem: FileSystemGateway,
  settings: LoggingSettings,
): { logger: Logger; logReader: LogFileReader | null; logBuffer: LogBufferReader | null } {
  const transports: LogTransport[] = [];
  let logReader: LogFileReader | null = null;
  let logBuffer: LogBufferReader | null = null;
  if (settings.console) {
    transports.push(new ConsoleTransport());
  }
  if (settings.file) {
    const fileTransport = new FileTransport(fileSystem);
    transports.push(fileTransport);
    logReader = fileTransport;
  }
  if (config.diagnosticsEnabled) {
    const bufferTransport = new InMemoryLogTransport();
    transports.push(bufferTransport);
    logBuffer = bufferTransport;
  }
  const logger = new CompositeLogger({ transports, minimumLevel: config.logging.minimumLevel });
  return { logger, logReader, logBuffer };
}
