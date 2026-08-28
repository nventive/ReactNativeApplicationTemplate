import * as FileSystem from 'expo-file-system/legacy';

import type { FileSystemGateway } from './FileSystemGateway';

/**
 * The real `FileSystemGateway`, backed by expo-file-system.
 *
 * This is the **only** file that imports the native package, keeping the file
 * log transport (and its tests) free of native dependencies. It uses the
 * `expo-file-system/legacy` API (`documentDirectory` + string read/write),
 * which is the stable surface for this use; the newer `File`/`Directory` API is
 * unnecessary here.
 *
 * expo-file-system has no atomic append, so this gateway only reads and replaces
 * whole files; `FileTransport` batches writes and serializes them onto a promise
 * chain so the read-modify-write it does on top can never interleave.
 */
export class ExpoFileSystemGateway implements FileSystemGateway {
  readonly documentDirectory = FileSystem.documentDirectory ?? 'file:///';

  async exists(uri: string): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  }

  async readAsString(uri: string): Promise<string> {
    if (!(await this.exists(uri))) {
      return '';
    }
    return FileSystem.readAsStringAsync(uri);
  }

  async writeString(uri: string, content: string): Promise<void> {
    await FileSystem.writeAsStringAsync(uri, content);
  }

  async delete(uri: string): Promise<void> {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
