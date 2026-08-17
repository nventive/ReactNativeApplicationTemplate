import type { LogEntry } from './Logger';

/**
 * The `meta` key transports/consumers use to categorize a log entry, so the
 * in-app console can filter by source without parsing the message text.
 */
export const LOG_CATEGORY_KEY = 'category';

/**
 * Category tag the HTTP interceptors stamp on request/response/error entries, so
 * the in-app log console can offer a "Network" filter (the in-app HTTP inspector).
 * Because HTTP is already logged through the shared `Logger`, tagging is all the
 * inspector needs; there is no separate capture store.
 */
export const NETWORK_LOG_CATEGORY = 'network';

/** Whether an entry was produced by the HTTP layer (tagged {@link NETWORK_LOG_CATEGORY}). */
export function isNetworkLogEntry(entry: LogEntry): boolean {
  return entry.meta?.[LOG_CATEGORY_KEY] === NETWORK_LOG_CATEGORY;
}
