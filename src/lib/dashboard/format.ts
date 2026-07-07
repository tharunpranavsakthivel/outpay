/**
 * Formatting helpers shared by the dashboard server layer and client views.
 */

/**
 * Formats a USD amount for compact dashboard presentation.
 *
 * Parameters:
 * - value: Number-like value from PostgreSQL aggregates.
 *
 * Returns:
 * - Dollar-prefixed string with two decimal places.
 */
export function formatUsd(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

/**
 * Formats an amount/token pair for payment and checkout rows.
 *
 * Parameters:
 * - amount: Number-like token amount from PostgreSQL.
 * - symbol: Token symbol such as USDC.
 *
 * Returns:
 * - Human-readable value with a symbol suffix.
 */
export function formatTokenAmount(
  amount: number | string | null | undefined,
  symbol: string,
) {
  const numericValue =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
        ? Number(amount)
        : 0;

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0)} ${symbol}`;
}

/**
 * Formats a timestamp for the authenticated dashboard surfaces.
 *
 * Parameters:
 * - value: ISO timestamp from PostgreSQL.
 *
 * Returns:
 * - Localized dashboard label, or `null` when the value is absent.
 */
export function formatDashboardDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Formats a shorter date for compact list rows.
 *
 * Parameters:
 * - value: ISO timestamp from PostgreSQL.
 *
 * Returns:
 * - Date string such as `Jul 7, 2026`, or `null` when absent.
 */
export function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

/**
 * Truncates long wallet addresses and transaction hashes for table display.
 *
 * Parameters:
 * - value: Hex-like identifier to truncate.
 *
 * Returns:
 * - Shortened string retaining the beginning and end.
 */
export function truncateIdentifier(value: string) {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
