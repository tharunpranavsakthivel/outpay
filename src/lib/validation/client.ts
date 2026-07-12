/**
 * Client-side helpers for rendering structured validation errors returned by
 * Outpay API routes without coupling views to a response implementation.
 */

export type FieldErrors = Record<string, string>;

interface ApiErrorDetail {
  field?: unknown;
  issue?: unknown;
}

interface ApiErrorPayload {
  error?: {
    details?: unknown;
    message?: unknown;
  };
}

/**
 * Narrows an unknown fetch payload to the API error envelope shape.
 *
 * Parameters:
 * - payload: Parsed JSON returned by an Outpay API request.
 *
 * Returns:
 * - A typed error envelope or `null` when no usable error exists.
 */
function getApiErrorPayload(payload: unknown): ApiErrorPayload | null {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return null;
  }

  const candidate = payload as { error?: unknown };

  if (
    !candidate.error ||
    typeof candidate.error !== "object" ||
    Array.isArray(candidate.error)
  ) {
    return null;
  }

  return payload as ApiErrorPayload;
}

/**
 * Reports whether a parsed payload contains the API error envelope.
 *
 * Parameters:
 * - payload: Parsed JSON returned by an Outpay API request.
 *
 * Returns:
 * - `true` when the payload contains an object-valued `error` property.
 */
export function hasApiError(payload: unknown): boolean {
  return getApiErrorPayload(payload) !== null;
}

/**
 * Extracts a human-readable API error message with a view-specific fallback.
 *
 * Parameters:
 * - payload: Parsed JSON returned by an Outpay API request.
 * - fallback: Message shown when the payload is not an API error envelope.
 *
 * Returns:
 * - Human-readable error message for a toast or form summary.
 */
export function getApiErrorMessage(payload: unknown, fallback: string): string {
  const errorPayload = getApiErrorPayload(payload);
  const message = errorPayload?.error?.message;

  return typeof message === "string" && message.trim() ? message : fallback;
}

/**
 * Extracts field-level validation messages from an API error envelope.
 *
 * Parameters:
 * - payload: Parsed JSON returned by an Outpay API request.
 *
 * Returns:
 * - Field-to-message map suitable for the `Input` component's `error` prop.
 */
export function getApiFieldErrors(payload: unknown): FieldErrors {
  const errorPayload = getApiErrorPayload(payload);
  const details = errorPayload?.error?.details;

  if (!Array.isArray(details)) {
    return {};
  }

  return details.reduce<FieldErrors>((errors, detail) => {
    if (!detail || typeof detail !== "object") {
      return errors;
    }

    const candidate = detail as ApiErrorDetail;

    if (
      typeof candidate.field === "string" &&
      candidate.field.length > 0 &&
      typeof candidate.issue === "string" &&
      candidate.issue.length > 0
    ) {
      errors[candidate.field] = candidate.issue;
    }

    return errors;
  }, {});
}
