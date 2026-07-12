/**
 * Regression coverage for request correlation and structured-log redaction.
 */

import { describe, expect, it } from "bun:test";
import {
  getRequestId,
  sanitizeLogFields,
  withRequestLogging,
} from "@/lib/logging/logger";

describe("structured logging", () => {
  it("redacts sensitive fields and credential-bearing text before serialization", () => {
    const sanitized = sanitizeLogFields({
      api_key: "ck_live_public_secret",
      authorization: "Bearer super-secret-token",
      database_url: "postgresql://postgres:password@db.example.com:5432/outpay",
      nested: {
        password: "db-password",
        webhookSigningSecret: "whsec-secret",
      },
      safe_identifier: "checkout_123",
    });

    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain("ck_live_public_secret");
    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain("postgresql://postgres:password");
    expect(serialized).not.toContain("db-password");
    expect(serialized).not.toContain("whsec-secret");
    expect(sanitized.safe_identifier).toBe("checkout_123");
  });

  it("honors a valid incoming request ID and generates one for invalid input", () => {
    const request = new Request("https://outpay.test/api/checkouts", {
      headers: { "x-request-id": "support-ticket-123" },
    });
    const invalidRequest = new Request("https://outpay.test/api/checkouts", {
      headers: { "x-request-id": "contains spaces" },
    });

    expect(getRequestId(request)).toBe("support-ticket-123");
    expect(getRequestId(invalidRequest)).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("adds the correlated request ID to wrapped route responses", async () => {
    const handler = withRequestLogging("/api/test GET", async () =>
      Response.json({ ok: true }),
    );
    const response = await handler(
      new Request("https://outpay.test/api/test", {
        headers: { "x-correlation-id": "ticket-456" },
      }),
      {},
    );

    expect(response.headers.get("x-request-id")).toBe("ticket-456");
    expect(await response.json()).toEqual({ ok: true });
  });
});
