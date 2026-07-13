/**
 * Regression coverage for the merchant checkout status-history endpoint.
 * Database and session dependencies are mocked so the test proves merchant
 * scoping without requiring a live database.
 */

import { describe, expect, it, mock } from "bun:test";

type FakeSql = <T>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T>;

const executedQueries: string[] = [];

const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
  const query = strings.join(" ").toLowerCase();
  executedQueries.push(query);

  if (
    query.includes("from user_profiles up") &&
    query.includes("merchant_members")
  ) {
    return [
      {
        avatar_color: null,
        description: null,
        full_name: "Merchant Owner",
        logo_asset_id: null,
        merchant_id: "merchant-1",
        public_slug: "merchant",
        role: "owner",
        status: "active",
        store_name: "Merchant",
        support_email: null,
        two_factor_status: "disabled",
        unread_notifications: 0,
        user_id: "user-1",
        verification_status: "verified",
      },
    ] as T;
  }

  if (query.includes("from checkout_sessions cs")) {
    const checkoutRef = values.at(-1);
    if (checkoutRef !== "chk-owned") {
      return [] as T;
    }

    return [
      {
        checkout_id: "checkout-1",
        checkout_ref: "chk-owned",
      },
    ] as T;
  }

  if (query.includes("from wallet_addresses wa")) {
    return [
      {
        address: "0x1111111111111111111111111111111111111111",
        blockchain_name: "Base",
        chain_numeric_id: 8453,
        chain_slug: "base",
        token_contract: "0x2222222222222222222222222222222222222222",
        token_id: "token-1",
        token_symbol: "USDC",
        wallet_id: "wallet-2",
      },
    ] as T;
  }

  if (query.includes("from wallet_change_requests wcr")) {
    return [
      {
        applied_at: "2026-07-13T11:00:00.000Z",
        created_at: "2026-07-13T11:00:00.000Z",
        id: "wallet-change-1",
        new_wallet_address: "0x1111111111111111111111111111111111111111",
        notes: null,
        old_wallet_address: "0x3333333333333333333333333333333333333333",
        requested_by: "Merchant Owner",
        status: "applied",
      },
    ] as T;
  }

  if (query.includes("from merchants m")) {
    return [
      {
        billable_checkout_count: 0,
        directory_summary: null,
        free_allowance_count: 10,
        gross_volume_usd: "0",
        is_directory_listed: false,
        last_test_sent_at: null,
        paid_checkout_count: 0,
        plan_code: "standard_usage",
        plan_name: "Standard usage",
        platform_fee_usd: "0",
        signing_secret_prefix: null,
        status: null,
        url: null,
        usage_fee_rate: "0.015000",
        usage_month: "2026-07-01",
        website_url: null,
      },
    ] as T;
  }

  if (query.includes("from checkout_status_history h")) {
    return [
      {
        actor_name: "Merchant Owner",
        actor_type: "user",
        created_at: "2026-07-13T10:00:00.000Z",
        from_status: null,
        id: "1",
        message: "Checkout chk-owned was created from the merchant dashboard.",
        reason_code: "created",
        to_status: "pending",
      },
    ] as T;
  }

  return [] as T;
}) as FakeSql;

mock.module("@/lib/auth/server", () => ({
  getServerSession: async () => ({
    user: {
      email: "merchant@example.com",
    },
  }),
}));

mock.module("@/lib/database/client", () => ({
  connectToDatabase: async () => ({
    release: async () => undefined,
    source: "test",
    sql,
  }),
  DatabaseConnectionError: class DatabaseConnectionError extends Error {},
}));

describe("GET /api/checkouts/[checkoutRef]/history", () => {
  it("returns only the authenticated merchant checkout timeline", async () => {
    executedQueries.length = 0;
    const { GET } = await import(
      "@/app/api/checkouts/[checkoutRef]/history/route"
    );

    const response = await GET(
      new Request("http://localhost/api/checkouts/chk-owned/history"),
      {
        params: Promise.resolve({ checkoutRef: "chk-owned" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      checkoutRef: "chk-owned",
      history: [
        {
          actorName: "Merchant Owner",
          actorType: "user",
          createdAt: "2026-07-13T10:00:00.000Z",
          fromStatus: null,
          id: "1",
          message:
            "Checkout chk-owned was created from the merchant dashboard.",
          reasonCode: "created",
          toStatus: "pending",
        },
      ],
    });
    expect(
      executedQueries.some(
        (query) =>
          query.includes("from checkout_sessions cs") &&
          query.includes("where cs.merchant_id"),
      ),
    ).toBe(true);
  });

  it("returns 404 when the reference is outside the merchant scope", async () => {
    const { GET } = await import(
      "@/app/api/checkouts/[checkoutRef]/history/route"
    );

    const response = await GET(
      new Request("http://localhost/api/checkouts/chk-other/history"),
      {
        params: Promise.resolve({ checkoutRef: "chk-other" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("CHECKOUT_NOT_FOUND");
  });

  it("returns wallet changes only from the current merchant scope", async () => {
    executedQueries.length = 0;
    const { getStoreSettingsData } = await import("@/lib/dashboard/server");

    const data = await getStoreSettingsData();

    expect(data.walletChangeHistory).toEqual([
      {
        appliedAt: "2026-07-13T11:00:00.000Z",
        createdAt: "2026-07-13T11:00:00.000Z",
        id: "wallet-change-1",
        newWalletAddress: "0x1111111111111111111111111111111111111111",
        notes: null,
        oldWalletAddress: "0x3333333333333333333333333333333333333333",
        requestedBy: "Merchant Owner",
        status: "applied",
      },
    ]);
    expect(
      executedQueries.some(
        (query) =>
          query.includes("from wallet_change_requests wcr") &&
          query.includes("where wcr.merchant_id"),
      ),
    ).toBe(true);
  });
});
