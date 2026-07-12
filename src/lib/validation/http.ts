/**
 * Request-boundary helpers that turn Zod parse failures into the API's
 * structured field-level validation response.
 */

import type { z } from "zod";
import { type JsonErrorDetail, jsonError } from "@/lib/dashboard/http";

/**
 * Converts Zod issue paths into the stable field-level error shape returned by
 * dashboard API routes.
 *
 * Parameters:
 * - error: Zod validation error produced by a schema parse.
 *
 * Returns:
 * - Sanitized field and issue pairs safe to send to the caller.
 */
export function formatValidationDetails(error: z.ZodError): JsonErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : undefined,
    issue: issue.message,
  }));
}

/**
 * Parses a JSON request body against a Zod schema.
 *
 * Parameters:
 * - request: Incoming route-handler request.
 * - schema: Schema describing the accepted JSON body.
 *
 * Returns:
 * - A typed success result or a 400 response with field-level details.
 *
 * Edge cases:
 * - Malformed JSON is reported as a body validation error rather than
 *   escaping to a generic 422/500 handler.
 */
export async function parseJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<
  | { success: true; data: z.infer<TSchema> }
  | { success: false; response: Response }
> {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch (error) {
    return {
      response: jsonError(
        400,
        "VALIDATION_FAILED",
        "Request body must be valid JSON.",
        undefined,
        error,
        [{ field: "body", issue: "Expected valid JSON." }],
      ),
      success: false,
    };
  }

  const result = schema.safeParse(rawBody);

  if (!result.success) {
    return {
      response: jsonError(
        400,
        "VALIDATION_FAILED",
        "Request body contains invalid fields.",
        undefined,
        result.error,
        formatValidationDetails(result.error),
      ),
      success: false,
    };
  }

  return { data: result.data, success: true };
}

/**
 * Parses URL query parameters against a Zod schema.
 *
 * Parameters:
 * - searchParams: URL query parameters from a route request.
 * - schema: Schema describing the accepted query fields.
 *
 * Returns:
 * - A typed success result or a 400 response with field-level details.
 */
export function parseQueryParams<TSchema extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: TSchema,
):
  | { success: true; data: z.infer<TSchema> }
  | { success: false; response: Response } {
  const result = schema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!result.success) {
    return {
      response: jsonError(
        400,
        "VALIDATION_FAILED",
        "Query parameters contain invalid fields.",
        undefined,
        result.error,
        formatValidationDetails(result.error),
      ),
      success: false,
    };
  }

  return { data: result.data, success: true };
}

/**
 * Parses a dynamic route parameter object against a Zod schema.
 *
 * Parameters:
 * - params: Framework-provided dynamic route parameters.
 * - schema: Schema describing the accepted parameter names and values.
 *
 * Returns:
 * - A typed success result or a 400 response with field-level details.
 */
export function parseRouteParams<TSchema extends z.ZodType>(
  params: unknown,
  schema: TSchema,
):
  | { success: true; data: z.infer<TSchema> }
  | { success: false; response: Response } {
  const result = schema.safeParse(params);

  if (!result.success) {
    return {
      response: jsonError(
        400,
        "VALIDATION_FAILED",
        "Route parameters contain invalid fields.",
        undefined,
        result.error,
        formatValidationDetails(result.error),
      ),
      success: false,
    };
  }

  return { data: result.data, success: true };
}
