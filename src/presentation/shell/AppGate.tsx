import type { ReactNode } from 'react';

import { useServices } from '../../framework/composition/ServicesProvider';
import { ForcedUpdateScreen } from '../forcedUpdate/ForcedUpdateScreen';
import { useObservable } from '../hooks/useObservable';
import { KillSwitchScreen } from '../killSwitch/KillSwitchScreen';

/**
 * The operational blocking gate — a declarative wrapper that replaces the whole
 * app tree when an operational block is active, rather than issuing imperative
 * router redirects.
 *
 * It subscribes to the two operational observables and renders, in precedence
 * order:
 * 1. the {@link ForcedUpdateScreen} while an update is required (forced update
 *    **wins** over the kill switch), else
 * 2. the {@link KillSwitchScreen} while the kill switch is active, else
 * 3. the app (`children`).
 *
 * Both gates are observable-driven, so they **lift automatically** when the
 * remote state clears — the kill switch's in-session recovery and forced
 * update's "lifts when the flag clears" come for free. The
 * diagnostics overlay is mounted *outside* this gate, so a tester can always
 * reach it to toggle the mock flags back.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { forcedUpdate, killSwitch } = useServices();
  const isUpdateRequired = useObservable(forcedUpdate.isUpdateRequired$, false);
  const isKillSwitchActive = useObservable(killSwitch.isKillSwitchActive$, false);

  if (isUpdateRequired) {
    return <ForcedUpdateScreen />;
  }
  if (isKillSwitchActive) {
    return <KillSwitchScreen />;
  }
  return <>{children}</>;
}
