/**
 * Tier 1 — the one transport allowed to touch `console.*`. It must route each
 * log level onto the matching console method so RN devtools colorize/filter
 * correctly (trace/debug → debug, info → info, warn → warn, error/fatal → error).
 */
import { ConsoleTransport } from '../../../src/access/logger/ConsoleTransport';
import type { LogEntry } from '../../../src/access/logger/Logger';

function entry(level: LogEntry['level'], message = 'hello'): LogEntry {
  return { level, message, timestamp: new Date() };
}

describe('ConsoleTransport', () => {
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('routes trace and debug to console.debug', () => {
    const transport = new ConsoleTransport();

    transport.write(entry('trace'));
    transport.write(entry('debug'));

    expect(debugSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('routes info to console.info', () => {
    new ConsoleTransport().write(entry('info'));

    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it('routes warn to console.warn', () => {
    new ConsoleTransport().write(entry('warn'));

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('routes error and fatal to console.error', () => {
    const transport = new ConsoleTransport();

    transport.write(entry('error'));
    transport.write(entry('fatal'));

    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('writes the formatted line (message included)', () => {
    new ConsoleTransport().write(entry('info', 'a distinctive message'));

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('a distinctive message'));
  });
});
