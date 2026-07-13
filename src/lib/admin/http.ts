/**
 * HTTP error mapping for admin route handlers. The module keeps the strict
 * authentication boundary and the stable API error envelope consistent across
 * all `/api/admin/*` endpoints.
 */

import { jsonError } from "@/lib/dashboard/http";
import {
  AdminAuthenticationError,
  AdminAuthorizationError,
  AdminOperationError,
} from "./server";

/**
 * Converts an admin service failure into the public route error contract.
 *
 * Parameters:
 * - error: Unknown thrown service failure.
 * - fallbackCode: Route-specific code for unexpected operational failures.
 *
 * Returns:
 * - Structured JSON response with 401/403 for auth failures and 422 for
 *   validated-but-unavailable admin operations.
 */
export function adminErrorResponse(
  error: unknown,
  fallbackCode: string,
): Response {
  if (error instanceof AdminAuthenticationError) {
    return jsonError(401, error.code, error.message, undefined, error);
  }

  if (error instanceof AdminAuthorizationError) {
    return jsonError(403, error.code, error.message, undefined, error);
  }

  if (error instanceof AdminOperationError) {
    return jsonError(422, error.code, error.message, undefined, error);
  }

  return jsonError(
    500,
    fallbackCode,
    "The admin operation could not be completed.",
    undefined,
    error,
  );
}
