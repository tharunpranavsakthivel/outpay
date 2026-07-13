/**
 * Regression tests for the documented usage-fee formula and the SQL metering
 * trigger that applies it to confirmed paid payments.
 */

import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateProjectedUsageFee,
  STANDARD_FREE_TRANSACTION_ALLOWANCE,
  STANDARD_USAGE_FEE_RATE,
} from "@/lib/billing/metering";

const MIGRATION_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../db/migrations/0012_usage_metering_billing.up.sql",
);

describe("usage metering", () => {
  it("charges nothing while volume remains within the free allowance", () => {
    expect(
      calculateProjectedUsageFee({
        averageOrderValueUsd: 80,
        freeTransactionAllowance: STANDARD_FREE_TRANSACTION_ALLOWANCE,
        transactionCount: 1000,
        usageFeeRate: STANDARD_USAGE_FEE_RATE,
      }),
    ).toBe(0);
  });

  it("calculates 1.5% only on transactions after the allowance", () => {
    expect(
      calculateProjectedUsageFee({
        averageOrderValueUsd: 80,
        freeTransactionAllowance: STANDARD_FREE_TRANSACTION_ALLOWANCE,
        transactionCount: 1250,
        usageFeeRate: STANDARD_USAGE_FEE_RATE,
      }),
    ).toBe(300);
  });

  it("rounds usage fees to cents", () => {
    expect(
      calculateProjectedUsageFee({
        averageOrderValueUsd: 10.01,
        freeTransactionAllowance: 0,
        transactionCount: 1,
        usageFeeRate: STANDARD_USAGE_FEE_RATE,
      }),
    ).toBe(0.15);
  });

  it("rejects invalid pricing inputs", () => {
    expect(() =>
      calculateProjectedUsageFee({
        averageOrderValueUsd: -1,
        freeTransactionAllowance: 1000,
        transactionCount: 1,
        usageFeeRate: STANDARD_USAGE_FEE_RATE,
      }),
    ).toThrow("Usage fee inputs must be finite, non-negative numbers.");
  });

  it("meters paid transitions atomically and creates idempotent fee entries", async () => {
    const migration = await readFile(MIGRATION_PATH, "utf8");

    expect(migration).toMatch(/\('free', 'Free', 'active', 1000, 0,/);
    expect(migration).toMatch(
      /\('standard_usage', 'Standard usage', 'active', 1000, 0\.015,/,
    );
    expect(migration).toMatch(/\('corporate', 'Corporate', 'active', 0, 0,/);
    expect(migration).toMatch(
      /after insert or update of status on public\.payments/,
    );
    expect(migration).toMatch(
      /if new\.status <> 'paid' or \(tg_op = 'UPDATE' and old\.status = 'paid'\)/,
    );
    expect(migration).toMatch(/next_paid_count := current_paid_count \+ 1/);
    expect(migration).toMatch(
      /gross_volume_usd = current_gross_volume \+ new\.amount_usd/,
    );
    expect(migration).toMatch(/round\(new\.amount_usd \* fee_rate_value, 2\)/);
    expect(migration).toMatch(/uq_fee_ledger_entries_usage_payment/);
  });
});
