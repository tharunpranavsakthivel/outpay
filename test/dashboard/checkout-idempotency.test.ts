/**
 * Regression coverage for dashboard checkout idempotency replay.
 * Uses an in-memory SQL-tag mock to verify that two submissions with one key
 * create one checkout and one set of dependent payment records.
 */

import { describe, expect, it, mock } from "bun:test";

interface FakeCheckout {
  amount_token: string;
  checkout_ref: string;
  expires_at: string;
  id: string;
  public_token: string;
  status: string;
}

interface FakeWallet {
  address: string;
  blockchain_name: string;
  chain_numeric_id: number;
  chain_slug: string;
  token_contract: string;
  token_id: string;
  token_symbol: string;
  wallet_id: string;
}

type FakeSql = {
  <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  begin<T>(callback: (sql: FakeSql) => Promise<T>): Promise<T>;
};

describe("dashboard checkout idempotency", () => {
  it("replays one checkout for two submissions with the same key", async () => {
    let checkout: FakeCheckout | null = null;
    let checkoutInsertCount = 0;
    let paymentIntentInsertCount = 0;
    let statusHistoryInsertCount = 0;

    const wallet: FakeWallet = {
      address: `0x${"a".repeat(40)}`,
      blockchain_name: "Base",
      chain_numeric_id: 8453,
      chain_slug: "base",
      token_contract: `0x${"b".repeat(40)}`,
      token_id: "token-1",
      token_symbol: "USDC",
      wallet_id: "wallet-1",
    };

    const sql = (async (
      strings: TemplateStringsArray,
      ..._values: unknown[]
    ) => {
      const query = strings.join(" ").toLowerCase();

      if (query.includes("from merchants")) {
        return [{ status: "active" }];
      }

      if (
        query.includes("from checkout_sessions cs") &&
        query.includes("idempotency_key")
      ) {
        return checkout
          ? [
              {
                ...checkout,
                ...wallet,
              },
            ]
          : [];
      }

      if (
        query.includes("from wallet_addresses wa") &&
        query.includes("is_primary = true")
      ) {
        return [wallet];
      }

      if (query.includes("insert into checkout_sessions")) {
        checkoutInsertCount += 1;
        checkout = {
          amount_token: "12.50",
          checkout_ref: "chk_123",
          expires_at: "2026-07-13T12:00:00.000Z",
          id: "checkout-1",
          public_token: "public-token-1",
          status: "pending",
        };
        return [checkout];
      }

      if (query.includes("insert into payment_intents")) {
        paymentIntentInsertCount += 1;
        return [];
      }

      if (query.includes("insert into checkout_status_history")) {
        statusHistoryInsertCount += 1;
        return [];
      }

      return [];
    }) as FakeSql;

    let transactionTail = Promise.resolve();
    sql.begin = async <T>(
      callback: (transactionSql: FakeSql) => Promise<T>,
    ) => {
      const previousTransaction = transactionTail;
      let releaseTransaction!: () => void;
      transactionTail = new Promise((resolve) => {
        releaseTransaction = resolve;
      });

      await previousTransaction;
      try {
        return await callback(sql);
      } finally {
        releaseTransaction();
      }
    };

    mock.module("@/lib/database/client", () => ({
      connectToDatabase: async () => ({
        release: async () => undefined,
        source: "DATABASE_URL",
        sql,
      }),
      DatabaseConnectionError: class DatabaseConnectionError extends Error {},
    }));

    const { createCheckoutForMerchant } = await import(
      "@/lib/dashboard/server"
    );
    const input = {
      actorType: "user" as const,
      amount: "12.50",
      createdByUserId: "user-1",
      idempotencyKey: "dashboard-create-123",
      label: "Coffee",
      merchantId: "merchant-1",
      orderReference: "order-1",
      redirectUrl: "",
      source: "dashboard" as const,
      successUrl: "",
    };

    const [first, second] = await Promise.all([
      createCheckoutForMerchant(input),
      createCheckoutForMerchant(input),
    ]);

    expect(second).toEqual(first);
    expect(checkoutInsertCount).toBe(1);
    expect(paymentIntentInsertCount).toBe(1);
    expect(statusHistoryInsertCount).toBe(1);
  });
});
