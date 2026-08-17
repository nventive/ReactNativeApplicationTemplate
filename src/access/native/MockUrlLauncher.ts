import type { UrlLauncher } from './UrlLauncher';

/**
 * Recording {@link UrlLauncher} for tests: captures every opened URL instead of
 * touching the OS, and can be told to fail so the launch-error path is testable.
 */
export class MockUrlLauncher implements UrlLauncher {
  readonly openedUrls: string[] = [];

  constructor(private readonly shouldFail = false) {}

  openUrl(url: string): Promise<void> {
    this.openedUrls.push(url);
    return this.shouldFail
      ? Promise.reject(new Error(`MockUrlLauncher: refused to open ${url}`))
      : Promise.resolve();
  }
}
