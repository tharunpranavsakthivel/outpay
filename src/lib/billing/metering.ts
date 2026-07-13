/**
 * Shared pricing constants and client-safe fee calculations for the public
 * pricing calculator and billing regression tests. Durable usage accounting is
 * performed by the PostgreSQL trigger in migration 0012.
 */

export const STANDARD_FREE_TRANSACTION_ALLOWANCE = 1000;
export const STANDARD_USAGE_FEE_RATE = 0.015;

export interface ProjectedUsageFeeInput {
  averageOrderValueUsd: number;
  freeTransactionAllowance: number;
  transactionCount: number;
  usageFeeRate: number;
}

/**
 * Calculates the projected fee for billable transactions after the monthly
 * allowance.
 *
 * @param input - Transaction volume, average order value, allowance, and rate.
 * @returns The projected USD fee rounded to cents.
 * @throws Error when any input is negative or non-finite.
 */
export function calculateProjectedUsageFee(
  input: ProjectedUsageFeeInput,
): number {
  const values = [
    input.averageOrderValueUsd,
    input.freeTransactionAllowance,
    input.transactionCount,
    input.usageFeeRate,
  ];

  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Usage fee inputs must be finite, non-negative numbers.");
  }

  const billableTransactions = Math.max(
    0,
    input.transactionCount - input.freeTransactionAllowance,
  );
  const fee =
    billableTransactions * input.averageOrderValueUsd * input.usageFeeRate;

  return Math.round((fee + Number.EPSILON) * 100) / 100;
}
