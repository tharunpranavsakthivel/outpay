/**
 * Request reconstruction helpers for Better Auth route handlers.
 *
 * This module exposes the safe plain-Request conversion used when an auth
 * route needs to replace a request body while preserving its URL and headers.
 */

/**
 * Creates a JSON request for a rewritten Better Auth payload.
 *
 * Parameters:
 * - request: Incoming request whose URL, method, and headers should be kept.
 * - payload: JSON-serializable payload that replaces the original body.
 *
 * Returns:
 * - A native Request that can safely cross the Better Auth handler boundary.
 *
 * Edge cases:
 * - Stale body framing headers are removed because the rewritten JSON length
 *   differs from the original incoming request.
 */
export function createJsonAuthRequest(
  request: Request,
  payload: Record<string, unknown>,
): Request {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  return new Request(request.url, {
    body: JSON.stringify(payload),
    headers,
    method: request.method,
  });
}
