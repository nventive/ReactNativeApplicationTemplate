import Constants from 'expo-constants';

import { isEnvironment, type Environment } from '../../business/environment/EnvironmentService';

/**
 * The build-default environment, baked into `app.config.ts`'s `extra` at build
 * time and surfaced here through expo-constants.
 *
 * This module is the single place the app reads the build config; the runtime
 * `EnvironmentService` layers a persisted override on top of it. Falls back to
 * `development` when nothing is configured (or the value is unrecognized).
 */
export function getBuildDefaultEnvironment(): Environment {
  const configured = Constants.expoConfig?.extra?.defaultEnvironment;
  return isEnvironment(configured) ? configured : 'development';
}
