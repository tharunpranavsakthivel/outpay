/**
 * HTTP helpers for App Router route handlers used by the dashboard API.
 */

/**
 * Builds a JSON error response with a consistent envelope.
 *
 * Parameters:
 * - status: HTTP status code for the response.
 * - code: Stable application error code.
 * - message: Human-readable resolution-oriented error string.
 *
 * Returns:
 * - `Response` with a JSON error payload.
 */
export function jsonError(status: number, code: string, message: string) {
  return Response.json(
    {
      error: {
        code,
        message,
      },
    },
    {
      status,
    },
  );
}
