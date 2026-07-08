/**
 * Shared checkout-expiry policy helpers for dashboard mutations, public
 * checkout reads, and unit tests.
 */

const DEFAULT_CHECKOUT_TTL_SECONDS = 30 * 60;
const DEFAULT_CHECKOUT_DETECTED_GRACE_SECONDS = 10 * 60;

export interface CheckoutExpiryPolicy {
  detectedGraceSeconds: number;
  ttlSeconds: number;
}

export interface CheckoutExpiryResolution {
  effectiveExpiresAt: Date;
  expireAfter: Date;
  isWithinGraceWindow: boolean;
  shouldExpire: boolean;
}

/**
 * Resolves the runtime checkout-expiry policy from environment variables.
 *
 * Parameters:
 * - env: Process environment with optional Outpay checkout timing overrides.
 *
 * Returns:
 * - Parsed TTL and detected-payment grace window in seconds.
 */
export function getCheckoutExpiryPolicy(
  env: NodeJS.ProcessEnv = process.env,
): CheckoutExpiryPolicy {
  return {
    detectedGraceSeconds: readPositiveInteger(
      env.OUTPAY_CHECKOUT_DETECTED_GRACE_SECONDS,
      DEFAULT_CHECKOUT_DETECTED_GRACE_SECONDS,
    ),
    ttlSeconds: readPositiveInteger(
      env.OUTPAY_CHECKOUT_TTL_SECONDS,
      DEFAULT_CHECKOUT_TTL_SECONDS,
    ),
  };
}

/**
 * Calculates the expiry timestamp for a newly created checkout.
 *
 * Parameters:
 * - now: Creation timestamp.
 * - policy: TTL/grace configuration for checkouts.
 *
 * Returns:
 * - Expiry timestamp derived from the configured checkout TTL.
 */
export function calculateCheckoutExpiryFromNow(
  now: Date,
  policy: CheckoutExpiryPolicy,
): Date {
  return new Date(now.getTime() + policy.ttlSeconds * 1000);
}

/**
 * Resolves the effective expiry and lazy-expiry transition boundary for a
 * checkout read.
 *
 * Parameters:
 * - createdAt: Checkout creation timestamp used when `expiresAt` is still null.
 * - expiresAt: Persisted expiry timestamp, or `null` for legacy rows.
 * - now: Read timestamp.
 * - policy: TTL/grace configuration for checkouts.
 * - status: Current checkout status.
 *
 * Returns:
 * - Effective expiry, grace-window end, and whether the checkout should flip
 *   to `expired` on this read.
 */
export function resolveCheckoutExpiryResolution(input: {
  createdAt: Date | string;
  expiresAt: Date | string | null;
  now: Date | string;
  policy: CheckoutExpiryPolicy;
  status: string;
}): CheckoutExpiryResolution {
  const createdAt = coerceDate(input.createdAt);
  const now = coerceDate(input.now);
  const effectiveExpiresAt = input.expiresAt
    ? coerceDate(input.expiresAt)
    : calculateCheckoutExpiryFromNow(createdAt, input.policy);
  const expireAfter =
    input.status === "detected"
      ? new Date(
          effectiveExpiresAt.getTime() +
            input.policy.detectedGraceSeconds * 1000,
        )
      : effectiveExpiresAt;

  return {
    effectiveExpiresAt,
    expireAfter,
    isWithinGraceWindow:
      input.status === "detected" &&
      now.getTime() >= effectiveExpiresAt.getTime() &&
      now.getTime() < expireAfter.getTime(),
    shouldExpire: now.getTime() >= expireAfter.getTime(),
  };
}

/**
 * Parses a positive integer environment variable with a safe fallback.
 *
 * Parameters:
 * - rawValue: Raw environment variable string.
 * - fallback: Default value used when parsing fails.
 *
 * Returns:
 * - Parsed positive integer, or the fallback when the input is absent/invalid.
 */
function readPositiveInteger(
  rawValue: string | undefined,
  fallback: number,
): number {
  const trimmedValue = rawValue?.trim();

  if (!trimmedValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(trimmedValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

/**
 * Normalizes a date-like input into a `Date` instance.
 *
 * Parameters:
 * - value: Existing `Date` or ISO timestamp string.
 *
 * Returns:
 * - Concrete `Date` instance used by expiry calculations.
 */
function coerceDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
