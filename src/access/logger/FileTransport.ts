import type { FileSystemGateway } from './FileSystemGateway';
import type { LogEntry, LogFileReader } from './Logger';
import { formatLogEntry, type LogTransport } from './LogTransport';

const DEFAULT_FILE_NAME = 'application.log';

/**
 * Hard cap on the on-disk log file. Once a flush would push it past this, the
 * oldest whole lines are dropped — the file analogue of the in-memory buffer's
 * ring trim (`DEFAULT_LOG_BUFFER_CAPACITY`) — so `application.log` can never grow
 * without bound. ~2 MiB stays comfortably shareable while holding a deep tail of
 * recent history. Documented in `doc/Logging.md`.
 */
export const DEFAULT_MAX_LOG_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Appends log entries to a file (the diagnostics log viewer / share action
 * reads it, so it must be retrievable). Backed by a `FileSystemGateway` so it
 * carries no native dependency and is fully Tier-1 testable.
 *
 * `write` is synchronous and non-throwing: it buffers the formatted line and
 * schedules a single **batched flush** onto a promise chain (`writeQueue`) that
 * serializes all filesystem access. A burst of writes therefore collapses into
 * one read-modify-write instead of one per line (expo-file-system has no atomic
 * append), and every flush caps the file at `maxBytes`. `flush()` awaits the
 * tail of that chain.
 */
export class FileTransport implements LogTransport, LogFileReader {
  private readonly uri: string;
  private readonly maxBytes: number;
  private writeQueue: Promise<void> = Promise.resolve();
  private pending: string[] = [];
  private flushScheduled = false;

  constructor(
    private readonly gateway: FileSystemGateway,
    fileName: string = DEFAULT_FILE_NAME,
    options: { maxBytes?: number } = {},
  ) {
    this.uri = this.gateway.documentDirectory + fileName;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_LOG_FILE_BYTES;
  }

  write(entry: LogEntry): void {
    this.pending.push(formatLogEntry(entry));
    this.scheduleFlush();
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
    this.pending = [];
    this.enqueue(() => this.gateway.delete(this.uri));
    return this.flush();
  }

  /** Schedules at most one pending drain onto the serialized queue. */
  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    this.enqueue(() => this.drain());
  }

  /** Writes everything buffered so far in a single read-modify-write, capped. */
  private async drain(): Promise<void> {
    this.flushScheduled = false;
    if (this.pending.length === 0) return;
    const block = this.pending.join('\n') + '\n';
    this.pending = [];
    const existing = await this.gateway.readAsString(this.uri);
    await this.gateway.writeString(this.uri, capToMaxBytes(existing + block, this.maxBytes));
  }

  /** Chains an operation onto the serialized queue, swallowing its errors. */
  private enqueue(operation: () => Promise<void>): void {
    this.writeQueue = this.writeQueue.then(operation).catch(() => {
      // Logging is best-effort — a failed file write must never surface.
    });
  }
}

/** UTF-8 byte length; `TextEncoder` is available on Hermes and in Node. */
function byteLength(text: string): number {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).length : text.length;
}

/**
 * Caps `content` at `maxBytes` by dropping whole oldest lines, so the file never
 * exceeds the bound and never starts mid-line.
 */
function capToMaxBytes(content: string, maxBytes: number): string {
  if (byteLength(content) <= maxBytes) return content;
  const lines = content.split('\n');
  const kept: string[] = [];
  let total = 0;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const lineBytes = byteLength(lines[i]) + 1; // + the '\n' this line contributes
    if (total + lineBytes > maxBytes && kept.length > 0) break;
    kept.unshift(lines[i]);
    total += lineBytes;
  }
  return kept.join('\n');
}
