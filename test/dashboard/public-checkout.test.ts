/**
 * Regression coverage for public checkout payment URI construction.
 * Uses a SQL-tag mock so the test verifies the database-provided chain ID
 * without requiring a live PostgreSQL instance.
 */

import { describe, expect, it, mock } from "bun:test";

type FakeSql = {
  <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  begin<T>(callback: (sql: FakeSql) => Promise<T>): Promise<T>;
};

describe("public checkout payment URI", () => {
  it("uses the joined blockchain numeric ID instead of a hardcoded chain", async () => {
    const queryTexts: string[] = [];
    const sql = (async (
      strings: TemplateStringsArray,
      ..._values: unknown[]
    ) => {
      const query = strings.join(" ");
      queryTexts.push(query);

      if (
        query.toLowerCase().includes("from checkout_sessions cs") &&
        query.toLowerCase().includes("join blockchains b")
      ) {
        return [
          {
            address: `0x${"a".repeat(40)}`,
            amount_token: "12.50",
            chain_name: "Ethereum Sepolia",
            chain_numeric_id: 11155111,
            checkout_ref: "chk_sepolia_123",
            display_name: "Test Merchant",
            expires_at: "2026-07-13T12:00:00.000Z",
            label: "Test order",
            public_token: "public-token-sepolia",
            redirect_url: null,
            status: "pending",
            symbol: "USDC",
          },
        ];
      }

      return [];
    }) as FakeSql;

    sql.begin = async <T>(callback: (sql: FakeSql) => Promise<T>) =>
      callback(sql);

    mock.module("@/lib/database/client", () => ({
      connectToDatabase: async () => ({
        release: async () => undefined,
        source: "DATABASE_URL",
        sql,
      }),
      DatabaseConnectionError: class DatabaseConnectionError extends Error {},
    }));

    const { getPublicCheckoutData } = await import("@/lib/dashboard/server");
    const result = await getPublicCheckoutData("public-token-sepolia");

    expect(result.paymentUri).toBe(
      `ethereum:0x${"a".repeat(40)}@11155111?value=12.50`,
    );
    expect(
      queryTexts.some((query) => query.includes("b.chain_numeric_id")),
    ).toBe(true);
  });
});
