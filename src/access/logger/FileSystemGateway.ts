/**
 * A narrow filesystem contract the file log transport depends on, so the
 * transport never imports the native `expo-file-system` package directly and
 * stays fully Tier-1 testable.
 *
 * Implementations: `ExpoFileSystemGateway` (real, device-only) and
 * `InMemoryFileSystemGateway` (a `Map`, for tests).
 *
 * All paths are `file://` URIs; `documentDirectory` is the base to build them
 * from.
 */
export interface FileSystemGateway {
  /** The app's writable document directory as a `file://` URI (trailing slash). */
  readonly documentDirectory: string;
  /** Whether a file exists at `uri`. */
  exists(uri: string): Promise<boolean>;
  /** Appends `line` (plus a newline) to the file at `uri`, creating it if absent. */
  appendLine(uri: string, line: string): Promise<void>;
  /** Reads the entire file at `uri` as a string (empty string if absent). */
  readAsString(uri: string): Promise<string>;
  /** Deletes the file at `uri` (no-op if absent). */
  delete(uri: string): Promise<void>;
}

/**
 * In-memory `FileSystemGateway` backed by a `Map`, for Tier-1 tests. Appends
 * concatenate in memory, so the file-transport's buffering/serialization logic
 * can be verified without a real (or mocked-native) filesystem.
 */
export class InMemoryFileSystemGateway implements FileSystemGateway {
  readonly documentDirectory = 'file:///memory/';
  private readonly files = new Map<string, string>();

  exists(uri: string): Promise<boolean> {
    return Promise.resolve(this.files.has(uri));
  }

  appendLine(uri: string, line: string): Promise<void> {
    this.files.set(uri, (this.files.get(uri) ?? '') + line + '\n');
    return Promise.resolve();
  }

  readAsString(uri: string): Promise<string> {
    return Promise.resolve(this.files.get(uri) ?? '');
  }

  delete(uri: string): Promise<void> {
    this.files.delete(uri);
    return Promise.resolve();
  }
}
