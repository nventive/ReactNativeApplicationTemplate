/** Options passed to the native share sheet when sharing a file. */
export interface ShareFileOptions {
  /** MIME type of the file (Android + web), e.g. `text/plain`. */
  mimeType?: string;
  /** Title for the share dialog (Android). */
  dialogTitle?: string;
  /** iOS Uniform Type Identifier, e.g. `public.plain-text`. */
  uti?: string;
}

/**
 * Shares an on-disk **file** through the OS share sheet — behind an Access
 * interface so features depend on a small, mockable contract rather than
 * importing a native module. The diagnostics log viewer uses it to share the
 * actual log file (via `LogFileReader.getUri()`), not the log text.
 *
 * This is deliberately distinct from {@link UrlLauncher} (which opens a URL in an
 * external app): sharing a `file://` URI needs the share sheet, which RN's core
 * `Share` cannot do on Android — hence expo-sharing.
 */
export interface FileSharer {
  /** Whether the OS supports sharing a file on this platform (false on web). */
  isAvailable(): Promise<boolean>;

  /**
   * Opens the share sheet for the file at `uri` (a `file://` URI). Rejects if the
   * share cannot be started so callers can surface a localized error.
   */
  shareFile(uri: string, options?: ShareFileOptions): Promise<void>;
}
