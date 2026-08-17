/**
 * Supplies and refreshes the bearer token for authenticated requests.
 *
 * The template ships only a stub (`MockTokenProvider`) in Phase 2; a real
 * implementation lands with an auth feature. The HTTP client's auth-refresh
 * interceptor drives the 401 → refresh → retry flow through this interface.
 */
export interface TokenProvider {
  /** The current access token to stamp onto requests, or `null` if unauthenticated. */
  getToken(): Promise<string | null>;
  /**
   * Exchanges the (expired) token for a fresh one. Resolves to `null` — or
   * rejects — if refresh fails, which the interceptor treats as session loss.
   */
  refreshToken(current: string | null): Promise<string | null>;
  /** Called when refresh fails; clears state and signals the app to route to login. */
  onSessionExpired(): void;
}

/**
 * A no-auth stub: no token, refresh always fails. Wired by default so the HTTP
 * client works for the unauthenticated sample API, while the interceptor's
 * refresh/retry path stays exercised by tests.
 */
export class MockTokenProvider implements TokenProvider {
  getToken(): Promise<string | null> {
    return Promise.resolve(null);
  }

  refreshToken(): Promise<string | null> {
    return Promise.resolve(null);
  }

  onSessionExpired(): void {
    // no-op
  }
}
