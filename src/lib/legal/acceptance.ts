/**
 * Server-side signup legal-acceptance helpers.
 *
 * These helpers validate the explicit checkbox flags at the auth boundary and
 * replace any client-supplied timestamps with a server-generated timestamp.
 */

export const LEGAL_ACCEPTANCE_REQUIRED_MESSAGE =
  "Accept the Terms of Service and Privacy Policy before creating an account.";

/**
 * Checks whether a signup payload contains both required legal acknowledgements.
 *
 * Parameters:
 * - payload: Parsed JSON or form payload from the signup request.
 *
 * Returns:
 * - `true` when both acknowledgement flags are explicitly enabled.
 */
export function hasRequiredSignupLegalAcceptance(
  payload: Record<string, unknown>,
): boolean {
  return (
    isAcceptedFlag(payload.termsAccepted) &&
    isAcceptedFlag(payload.privacyAccepted)
  );
}

/**
 * Adds server-generated legal acceptance timestamps to an auth payload.
 *
 * Parameters:
 * - payload: Parsed signup payload. Existing timestamp fields are ignored.
 * - acceptedAt: Timestamp used for deterministic tests or an injected clock.
 *
 * Returns:
 * - A new payload containing ISO timestamps for both accepted documents.
 */
export function applyServerLegalAcceptance(
  payload: Record<string, unknown>,
  acceptedAt = new Date(),
): Record<string, unknown> {
  const timestamp = acceptedAt.toISOString();

  return {
    ...payload,
    privacyAcceptedAt: timestamp,
    termsAcceptedAt: timestamp,
  };
}

/**
 * Accepts boolean JSON values and their form-encoded string equivalent.
 *
 * Parameters:
 * - value: Raw value from JSON or form data.
 *
 * Returns:
 * - `true` only for an explicit accepted flag.
 */
function isAcceptedFlag(value: unknown): boolean {
  return value === true || value === "true";
}
