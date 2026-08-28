/**
 * A narrow filesystem contract the file log transport depends on, so the
 * transport never imports the native `expo-file-system` package directly and
 * stays fully Tier-1 testable.
 *
 * Implementations: `ExpoFileSystemGateway` (real, device-only) and
 * `InMemoryFileSystemGateway` (a `Map`, for tests).
 *
 * The gateway is deliberately dumb I/O: it reads and replaces whole files.
 * `FileTransport` owns the append/batch/size-cap policy on top of it, so the
 * bounded read-modify-write lives in a single, fully testable place.
 *
 * All paths are `file://` URIs; `documentDirectory` is the base to build them
 * from.
 */
export interface FileSystemGateway {
  /** The app's writable document directory as a `file://` URI (trailing slash). */
  readonly documentDirectory: string;
  /** Whether a file exists at `uri`. */
  exists(uri: string): Promise<boolean>;
  /** Reads the entire file at `uri` as a string (empty string if absent). */
  readAsString(uri: string): Promise<string>;
  /** Overwrites the file at `uri` with `content`, creating it if absent. */
  writeString(uri: string, content: string): Promise<void>;
  /** Deletes the file at `uri` (no-op if absent). */
  delete(uri: string): Promise<void>;
}

/**
 * In-memory `FileSystemGateway` backed by a `Map`, for Tier-1 tests, so the
 * file-transport's batching / size-cap logic can be verified without a real
 * (or mocked-native) filesystem.
 */
export class InMemoryFileSystemGateway implements FileSystemGateway {
  readonly documentDirectory = 'file:///memory/';
  private readonly files = new Map<string, string>();

  exists(uri: string): Promise<boolean> {
    return Promise.resolve(this.files.has(uri));
  }

  readAsString(uri: string): Promise<string> {
    return Promise.resolve(this.files.get(uri) ?? '');
  }

  writeString(uri: string, content: string): Promise<void> {
    this.files.set(uri, content);
    return Promise.resolve();
  }

  delete(uri: string): Promise<void> {
    this.files.delete(uri);
    return Promise.resolve();
  }
}
