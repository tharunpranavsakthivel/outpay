/**
 * HTTP helpers for App Router route handlers used by the dashboard API.
 */

import {
  getRequestLogContext,
  logApiErrorResponse,
  withRequestIdHeader,
} from "@/lib/logging/logger";

export interface JsonErrorDetail {
  field?: string;
  issue: string;
}

/**
 * Builds a JSON error response with a consistent envelope.
 *
 * Parameters:
 * - status: HTTP status code for the response.
 * - code: Stable application error code.
 * - message: Human-readable resolution-oriented error string.
 * - headers: Optional response headers such as `Retry-After`.
 * - error: Optional caught exception to include in the server-side log.
 * - details: Optional field-level details for validation errors.
 *
 * Returns:
 * - `Response` with a JSON error payload.
 */
export function jsonError(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
  error?: unknown,
  details: JsonErrorDetail[] = [],
) {
  const context = getRequestLogContext();
  logApiErrorResponse({
    err: error,
    error_code: code,
    status,
  });

  const responseBody = {
    error: {
      code,
      ...(details.length > 0 ? { details } : {}),
      message,
    },
  };

  const response = Response.json(responseBody, {
    headers,
    status,
  });

  return context ? withRequestIdHeader(response, context.request_id) : response;
}
