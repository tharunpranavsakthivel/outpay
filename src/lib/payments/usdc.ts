/**
 * USDC amount helpers for the payment-matching pipeline.
 *
 * Outpay's current schema stores checkout and payment amounts in
 * `numeric(20,8)` columns, but the matching rules in `ARCHITECTURE.md` require
 * integer base-unit comparisons. This module keeps the persisted decimal schema
 * unchanged for T-6 while converting every comparison to 6-decimal USDC units
 * so detection never relies on floating-point arithmetic.
 */

import { formatUnits, parseUnits } from "viem";

export const USDC_DECIMALS = 6;
const DEFAULT_SLIGHT_OVERPAY_TOLERANCE = "0.01";

export interface UsdcAmountPolicy {
  slightOverpayToleranceUnits: bigint;
}

export interface UsdcAmountComparison {
  amountPolicy: "exact" | "large_overpay" | "slight_overpay" | "underpaid";
  differenceUnits: bigint;
}

/**
 * Resolves the runtime overpayment tolerance used by payment matching.
 *
 * Parameters:
 * - env: Environment containing the optional Outpay override.
 *
 * Returns:
 * - Integer-unit tolerance configuration for USDC comparisons.
 */
export function getUsdcAmountPolicy(
  env: NodeJS.ProcessEnv = process.env,
): UsdcAmountPolicy {
  return {
    slightOverpayToleranceUnits: parseUsdcDecimalToUnits(
      env.OUTPAY_USDC_SLIGHT_OVERPAY_TOLERANCE?.trim() ||
        DEFAULT_SLIGHT_OVERPAY_TOLERANCE,
    ),
  };
}

/**
 * Converts a database decimal string into 6-decimal USDC base units.
 *
 * Parameters:
 * - value: Decimal amount from PostgreSQL or configuration.
 *
 * Returns:
 * - Exact integer USDC units.
 *
 * Throws:
 * - `Error` when the value is empty, negative, or exceeds 6 meaningful
 *   decimals.
 */
export function parseUsdcDecimalToUnits(
  value: bigint | number | string,
): bigint {
  if (typeof value === "bigint") {
    if (value < BigInt(0)) {
      throw new Error("USDC units cannot be negative.");
    }

    return value;
  }

  const normalized = normalizeDecimalString(value);
  const [_wholePart, fractionalPart = ""] = normalized.split(".");
  const trimmedFractionalPart = fractionalPart.replace(/0+$/u, "");

  if (trimmedFractionalPart.length > USDC_DECIMALS) {
    throw new Error(
      `USDC amounts support at most ${USDC_DECIMALS} significant decimal places.`,
    );
  }

  return parseUnits(normalized, USDC_DECIMALS);
}

/**
 * Formats integer USDC units into a decimal string suitable for numeric
 * PostgreSQL columns.
 *
 * Parameters:
 * - units: Integer USDC units.
 * - scale: Decimal places to keep in the formatted output.
 *
 * Returns:
 * - Fixed-scale decimal string.
 */
export function formatUsdcUnitsForDatabase(
  units: bigint,
  scale = USDC_DECIMALS,
): string {
  if (units < BigInt(0)) {
    throw new Error("USDC units cannot be negative.");
  }

  const normalizedScale = Number.isInteger(scale) ? scale : USDC_DECIMALS;
  const decimal = formatUnits(units, USDC_DECIMALS);
  const [wholePart, fractionalPart = ""] = decimal.split(".");
  const paddedFractionalPart = fractionalPart.padEnd(USDC_DECIMALS, "0");

  if (normalizedScale === 0) {
    return wholePart;
  }

  return `${wholePart}.${paddedFractionalPart.slice(0, normalizedScale)}`;
}

/**
 * Converts integer USDC units into the 2-decimal USD storage format used by
 * `payments.amount_usd`.
 *
 * Parameters:
 * - units: Integer USDC units.
 *
 * Returns:
 * - Rounded USD decimal string with two fractional digits.
 */
export function formatUsdcUnitsAsUsd(units: bigint): string {
  if (units < BigInt(0)) {
    throw new Error("USDC units cannot be negative.");
  }

  const cents = (units + BigInt(5_000)) / BigInt(10_000);
  const wholePart = cents / BigInt(100);
  const fractionalPart = (cents % BigInt(100)).toString().padStart(2, "0");
  return `${wholePart.toString()}.${fractionalPart}`;
}

/**
 * Classifies an observed amount against the expected checkout amount.
 *
 * Parameters:
 * - expectedUnits: Checkout amount in integer USDC units.
 * - observedUnits: Transfer amount in integer USDC units.
 * - policy: Slight-overpay tolerance configuration.
 *
 * Returns:
 * - Deterministic amount-policy classification and signed difference.
 */
export function compareUsdcAmounts(
  expectedUnits: bigint,
  observedUnits: bigint,
  policy: UsdcAmountPolicy,
): UsdcAmountComparison {
  const differenceUnits = observedUnits - expectedUnits;

  if (differenceUnits === BigInt(0)) {
    return {
      amountPolicy: "exact",
      differenceUnits,
    };
  }

  if (differenceUnits < BigInt(0)) {
    return {
      amountPolicy: "underpaid",
      differenceUnits,
    };
  }

  if (differenceUnits <= policy.slightOverpayToleranceUnits) {
    return {
      amountPolicy: "slight_overpay",
      differenceUnits,
    };
  }

  return {
    amountPolicy: "large_overpay",
    differenceUnits,
  };
}

function normalizeDecimalString(value: number | string): string {
  const rawValue =
    typeof value === "number"
      ? Number.isFinite(value)
        ? value.toString()
        : ""
      : value.trim();

  if (!rawValue || !/^\d+(\.\d+)?$/u.test(rawValue)) {
    throw new Error("USDC amount must be a positive decimal string.");
  }

  return rawValue;
}
