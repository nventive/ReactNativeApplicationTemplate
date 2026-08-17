/**
 * Opens external URLs (store pages, web links) — the native `Linking` surface
 * behind an Access interface so features depend on a small, mockable contract
 * rather than importing `react-native` directly.
 */
export interface UrlLauncher {
  /**
   * Opens `url` in the appropriate external app (App Store / Play Store /
   * browser). Rejects if the URL cannot be opened, so callers can surface the
   * localized launch-error message.
   */
  openUrl(url: string): Promise<void>;
}
