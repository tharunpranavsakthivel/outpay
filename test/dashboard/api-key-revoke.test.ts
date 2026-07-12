/**
 * Unit tests for merchant-scoped API-key revocation behavior.
 */

import { describe, expect, it, mock } from "bun:test";
import { revokeApiKey } from "@/lib/dashboard/server";

describe("revokeApiKey", () => {
  it("revokes a merchant-owned key and returns the updated row", async () => {
    const updateOwnedApiKey = mock(async () => ({
      created_at: "2026-07-09T00:00:00.000Z",
      environment: "test",
      id: "key_123",
      key_prefix: "ck_test_abcd1234",
      last_four: "beef",
      last_used_at: "2026-07-09T00:01:00.000Z",
      name: "Primary key",
      scopes: ["checkouts:create", "payments:read"],
      status: "revoked",
    }));
    const recordAuditLog = mock(async () => undefined);

    const result = await revokeApiKey(
      {
        apiKeyId: "key_123",
      },
      {
        getMerchantContext: async () =>
          ({
            merchant: { merchantId: "merchant_123" },
            userId: "user_123",
          }) as never,
        recordAuditLog,
        updateOwnedApiKey,
      },
    );

    expect(updateOwnedApiKey).toHaveBeenCalledTimes(1);
    expect(updateOwnedApiKey.mock.calls[0]?.[0]).toEqual({
      apiKeyId: "key_123",
      merchantId: "merchant_123",
    });
    expect(recordAuditLog).toHaveBeenCalledTimes(1);
    expect(recordAuditLog.mock.calls[0]?.[0]).toEqual({
      action: "api_key_revoked",
      actorType: "user",
      actorUserId: "user_123",
      merchantId: "merchant_123",
      metadata: {
        environment: "test",
        name: "Primary key",
      },
      resourceId: "key_123",
      resourceType: "api_key",
    });
    expect(result).toEqual({
      createdAt: "2026-07-09T00:00:00.000Z",
      environment: "test",
      id: "key_123",
      keyPrefix: "ck_test_abcd1234",
      lastFour: "beef",
      lastUsedAt: "2026-07-09T00:01:00.000Z",
      name: "Primary key",
      scopes: ["checkouts:create", "payments:read"],
      status: "revoked",
    });
  });

  it("rejects revocation when the key does not belong to the current merchant", async () => {
    const updateOwnedApiKey = mock(async () => null);

    await expect(
      revokeApiKey(
        {
          apiKeyId: "key_999",
        },
        {
          getMerchantContext: async () =>
            ({
              merchant: { merchantId: "merchant_123" },
            }) as never,
          updateOwnedApiKey,
        },
      ),
    ).rejects.toThrow("API key not found for this merchant.");
  });
});
