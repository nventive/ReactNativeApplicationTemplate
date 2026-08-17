import { Linking } from 'react-native';

import type { UrlLauncher } from './UrlLauncher';

/**
 * {@link UrlLauncher} backed by React Native's core `Linking` module — no extra
 * native dependency, works from a prebuild/dev-client build. This is the only
 * file that imports `Linking`.
 */
export class LinkingUrlLauncher implements UrlLauncher {
  async openUrl(url: string): Promise<void> {
    // `openURL` rejects on its own when the OS has no handler; surfacing that
    // rejection is exactly the "could not launch" path the caller localizes.
    await Linking.openURL(url);
  }
}
