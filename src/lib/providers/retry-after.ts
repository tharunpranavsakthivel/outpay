/**
 * Shared `Retry-After` header parsing for RPC provider clients.
 */

/**
 * Parses an HTTP `Retry-After` header value into a millisecond delay.
 *
 * Parameters:
 * - headerValue: Raw header value, either a delay in seconds or an HTTP-date.
 *
 * Returns:
 * - Non-negative millisecond delay, or `null` when the header is absent or
 *   unparseable.
 */
export function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) {
    return null;
  }

  const trimmed = headerValue.trim();
  const seconds = Number(trimmed);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const dateMs = Date.parse(trimmed);

  if (Number.isNaN(dateMs)) {
    return null;
  }

  return Math.max(0, dateMs - Date.now());
}
