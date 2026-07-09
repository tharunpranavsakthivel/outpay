/**
 * Unit tests for public API-key parsing and authentication behavior.
 */

import { describe, expect, it, mock } from "bun:test";
import {
  authenticateApiKey,
  hashApiKeySecret,
  parseApiKeyToken,
} from "@/lib/auth/api-key";

describe("API key authentication", () => {
  it("parses the current ck_<env>_<prefix>_<secret> format", () => {
    expect(parseApiKeyToken("ck_test_abc12345_deadbeef")).toEqual({
      environment: "test",
      hashInput: "deadbeef",
      keyPrefix: "ck_test_abc12345",
    });
  });

  it("accepts legacy outpay_* keys so previously created secrets remain usable", () => {
    expect(
      parseApiKeyToken("outpay_test_0123456789abcdef0123456789abcdef"),
    ).toEqual({
      environment: "test",
      hashInput: "outpay_test_0123456789abcdef0123456789abcdef",
      keyPrefix: "outpay_test_01",
    });
  });

  it("returns merchant context and updates last_used_at for valid keys", async () => {
    const touchLastUsedAt = mock(async () => undefined);

    const result = await authenticateApiKey(
      "Bearer ck_test_abcd1234_deadbeef",
      {
        findActiveApiKeyByPrefix: async () => ({
          environment: "test",
          id: "key_123",
          keyPrefix: "ck_test_abcd1234",
          merchantId: "merchant_123",
          scopes: ["checkouts:create", "payments:read"],
          secretHash: hashApiKeySecret("deadbeef"),
        }),
        touchLastUsedAt,
      },
    );

    expect(result).toEqual({
      apiKeyId: "key_123",
      environment: "test",
      merchantId: "merchant_123",
      scopes: ["checkouts:create", "payments:read"],
    });
    expect(touchLastUsedAt).toHaveBeenCalledTimes(1);
    expect(touchLastUsedAt.mock.calls[0]?.[0]).toBe("key_123");
  });

  it("fails uniformly when the secret does not match", async () => {
    const touchLastUsedAt = mock(async () => undefined);

    const result = await authenticateApiKey(
      "Bearer ck_test_abcd1234_wrongsecret",
      {
        findActiveApiKeyByPrefix: async () => ({
          environment: "test",
          id: "key_123",
          keyPrefix: "ck_test_abcd1234",
          merchantId: "merchant_123",
          scopes: ["checkouts:create"],
          secretHash: hashApiKeySecret("deadbeef"),
        }),
        touchLastUsedAt,
      },
    );

    expect(result).toBeNull();
    expect(touchLastUsedAt).not.toHaveBeenCalled();
  });
});
