import * as Sharing from 'expo-sharing';

import type { FileSharer, ShareFileOptions } from './FileSharer';

/**
 * {@link FileSharer} backed by expo-sharing — shares the actual file at a
 * `file://` URI through the native share sheet (works on both iOS and Android,
 * unlike RN's core `Share`, which can only share text on Android). This is the
 * only file that imports expo-sharing.
 */
export class ExpoFileSharer implements FileSharer {
  isAvailable(): Promise<boolean> {
    return Sharing.isAvailableAsync();
  }

  async shareFile(uri: string, options?: ShareFileOptions): Promise<void> {
    await Sharing.shareAsync(uri, {
      mimeType: options?.mimeType,
      dialogTitle: options?.dialogTitle,
      UTI: options?.uti,
    });
  }
}
