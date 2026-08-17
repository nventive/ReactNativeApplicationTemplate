/**
 * Tier 1 — plain TS. Covers the logging building blocks: the level filter, the
 * composite logger's filter+fan-out, and the file transport against the
 * in-memory filesystem gateway.
 */
import { CompositeLogger } from '../../../src/access/logger/CompositeLogger';
import { FileTransport } from '../../../src/access/logger/FileTransport';
import { InMemoryFileSystemGateway } from '../../../src/access/logger/FileSystemGateway';
import { shouldLog } from '../../../src/access/logger/LevelFilter';
import { parseLogLevel } from '../../../src/access/logger/LogLevel';
import type { LogEntry } from '../../../src/access/logger/Logger';
import type { LogTransport } from '../../../src/access/logger/LogTransport';

class RecordingTransport implements LogTransport {
  readonly entries: LogEntry[] = [];
  write(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

describe('parseLogLevel', () => {
  it('maps the "warning" spelling to "warn"', () => {
    expect(parseLogLevel('warning')).toBe('warn');
  });

  it('falls back to "debug" for unknown input', () => {
    expect(parseLogLevel(undefined)).toBe('debug');
    expect(parseLogLevel('nonsense')).toBe('debug');
  });
});

describe('shouldLog', () => {
  it('emits at or above the minimum, suppresses below', () => {
    expect(shouldLog('warn', 'info')).toBe(true);
    expect(shouldLog('info', 'info')).toBe(true);
    expect(shouldLog('debug', 'info')).toBe(false);
  });
});

describe('CompositeLogger', () => {
  it('filters below the minimum level before fan-out', () => {
    const transport = new RecordingTransport();
    const logger = new CompositeLogger({ transports: [transport], minimumLevel: 'info' });

    logger.debug('suppressed');
    logger.info('kept');
    logger.error('kept too', new Error('boom'));

    expect(transport.entries.map((e) => e.message)).toEqual(['kept', 'kept too']);
    expect(transport.entries[1].error).toBeInstanceOf(Error);
  });

  it('fans one entry out to every transport', () => {
    const a = new RecordingTransport();
    const b = new RecordingTransport();
    const logger = new CompositeLogger({ transports: [a, b], minimumLevel: 'trace' });

    logger.info('hello', { user: 'jp' });

    expect(a.entries).toHaveLength(1);
    expect(b.entries).toHaveLength(1);
    expect(a.entries[0].meta).toEqual({ user: 'jp' });
  });

  it('never lets a throwing transport crash the caller', () => {
    const throwing: LogTransport = {
      write() {
        throw new Error('transport down');
      },
    };
    const ok = new RecordingTransport();
    const logger = new CompositeLogger({ transports: [throwing, ok], minimumLevel: 'trace' });

    expect(() => logger.error('still works')).not.toThrow();
    expect(ok.entries).toHaveLength(1);
  });
});

describe('FileTransport', () => {
  it('appends entries and reads them back through the gateway', async () => {
    const gateway = new InMemoryFileSystemGateway();
    const transport = new FileTransport(gateway, 'test.log');

    transport.write({ level: 'info', message: 'first', timestamp: new Date('2026-01-01') });
    transport.write({ level: 'warn', message: 'second', timestamp: new Date('2026-01-01') });

    const contents = await transport.read();
    expect(contents).toContain('first');
    expect(contents).toContain('second');
    expect(contents.trim().split('\n')).toHaveLength(2);
  });

  it('reports existence and clears the file', async () => {
    const gateway = new InMemoryFileSystemGateway();
    const transport = new FileTransport(gateway, 'test.log');

    expect(await transport.exists()).toBe(false);
    transport.write({ level: 'info', message: 'x', timestamp: new Date() });
    expect(await transport.exists()).toBe(true);

    await transport.clear();
    expect(await transport.exists()).toBe(false);
  });

  it('exposes a file:// URI under the gateway document directory', () => {
    const gateway = new InMemoryFileSystemGateway();
    const transport = new FileTransport(gateway, 'app.log');

    expect(transport.getUri()).toBe('file:///memory/app.log');
  });
});
