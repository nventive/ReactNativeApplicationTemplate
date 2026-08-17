import { z } from 'zod';

import { tryParseVersion, version, type Version } from '../version/Version';

/**
 * The typed remote-config values the operational features consume. This is the
 * whole remote-config schema the template needs — two Firebase Remote Config
 * keys:
 *
 * - `minimum_version` → {@link minimumVersion} (forced update)
 * - `is_kill_switch_active` → {@link killSwitchActive} (kill switch)
 *
 * More keys are added here as remote-driven features are added.
 */
export interface RemoteConfigValues {
  /** The lowest app version allowed to run; forced update fires below it. */
  readonly minimumVersion: Version;
  /** Whether the remote kill switch is currently active. */
  readonly killSwitchActive: boolean;
}

/**
 * Safe local defaults, applied before any remote fetch resolves (and the values
 * a build ships with when there is no backend). They must never block the app:
 * a `1.0.0` minimum passes for any release, and the kill switch is off.
 */
export const REMOTE_CONFIG_DEFAULTS: RemoteConfigValues = {
  minimumVersion: version(1, 0, 0),
  killSwitchActive: false,
};

/**
 * The Firebase Remote Config **key names** (the console/wire keys). The real
 * provider reads these keys; the typed {@link RemoteConfigValues} above is the
 * mapped result.
 */
export const REMOTE_CONFIG_KEYS = {
  minimumVersion: 'minimum_version',
  killSwitchActive: 'is_kill_switch_active',
} as const;

/**
 * zod schema for the **raw** remote payload — the wire shape Firebase Remote
 * Config returns: a version string and a boolean. Parsing happens at the
 * Access boundary; a malformed value fails soft to the default (remote config is
 * operational data, not a network response we own — `doc/Serialization.md`).
 */
export const remoteConfigPayloadSchema = z.object({
  minimum_version: z.string(),
  is_kill_switch_active: z.boolean(),
});

export type RemoteConfigPayload = z.infer<typeof remoteConfigPayloadSchema>;

/**
 * Maps a raw payload to typed {@link RemoteConfigValues}, falling back to the
 * defaults for any field that is missing or malformed. This is what a real
 * provider runs after `remoteConfigPayloadSchema.safeParse`.
 */
export function toRemoteConfigValues(payload: Partial<RemoteConfigPayload>): RemoteConfigValues {
  const parsedVersion =
    payload.minimum_version !== undefined ? tryParseVersion(payload.minimum_version) : undefined;
  return {
    minimumVersion: parsedVersion ?? REMOTE_CONFIG_DEFAULTS.minimumVersion,
    killSwitchActive: payload.is_kill_switch_active ?? REMOTE_CONFIG_DEFAULTS.killSwitchActive,
  };
}
