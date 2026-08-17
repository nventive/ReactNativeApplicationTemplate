import type { FileSharer, ShareFileOptions } from './FileSharer';

/** A recorded share request captured by {@link MockFileSharer}. */
export interface SharedFile {
  readonly uri: string;
  readonly options?: ShareFileOptions;
}

/**
 * Recording {@link FileSharer} for tests: captures the shared file URI + options
 * instead of opening the share sheet, and can report itself unavailable so that
 * path is testable too.
 */
export class MockFileSharer implements FileSharer {
  readonly shared: SharedFile[] = [];

  constructor(private readonly available = true) {}

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.available);
  }

  shareFile(uri: string, options?: ShareFileOptions): Promise<void> {
    this.shared.push({ uri, options });
    return Promise.resolve();
  }
}
