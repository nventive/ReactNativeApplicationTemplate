import type { FileSystemGateway } from './FileSystemGateway';
import type { LogEntry, LogFileReader } from './Logger';
import { formatLogEntry, type LogTransport } from './LogTransport';

const DEFAULT_FILE_NAME = 'application.log';

/**
 * Appends log entries to a file (the diagnostics log viewer / share action
 * reads it, so it must be retrievable). Backed by a `FileSystemGateway` so it
 * carries no native dependency and is fully Tier-1 testable.
 *
 * `write` is synchronous and non-throwing: it enqueues the append onto a
 * promise chain (`writeQueue`) that serializes all filesystem access, so the
 * lack of an atomic append in expo-file-system can't cause interleaved
 * read-modify-writes. `flush()` awaits the tail of that chain.
 */
export class FileTransport implements LogTransport, LogFileReader {
  private readonly uri: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly gateway: FileSystemGateway,
    fileName: string = DEFAULT_FILE_NAME,
  ) {
    this.uri = this.gateway.documentDirectory + fileName;
  }

  write(entry: LogEntry): void {
    const line = formatLogEntry(entry);
    this.enqueue(() => this.gateway.appendLine(this.uri, line));
  }

  flush(): Promise<void> {
    return this.writeQueue;
  }

  async exists(): Promise<boolean> {
    await this.flush();
    return this.gateway.exists(this.uri);
  }

  async read(): Promise<string> {
    await this.flush();
    return this.gateway.readAsString(this.uri);
  }

  getUri(): string {
    return this.uri;
  }

  clear(): Promise<void> {
    this.enqueue(() => this.gateway.delete(this.uri));
    return this.flush();
  }

  /** Chains an operation onto the serialized queue, swallowing its errors. */
  private enqueue(operation: () => Promise<void>): void {
    this.writeQueue = this.writeQueue.then(operation).catch(() => {
      // Logging is best-effort — a failed file write must never surface.
    });
  }
}
