/**
 * Regression tests for the native Request rewrite used by the Better Auth
 * signup route under Next.js 16.
 */

import { describe, expect, test } from "bun:test";
import { createJsonAuthRequest } from "@/lib/auth/request";

describe("Better Auth request rewrite", () => {
  test("preserves the route while replacing body framing safely", async () => {
    const request = new Request(
      "https://outpay.tech/api/auth/sign-up/email?source=signup",
      {
        body: JSON.stringify({ email: "merchant@example.com" }),
        headers: {
          "content-length": "37",
          "content-type": "application/json",
          "x-request-id": "signup-regression-test",
        },
        method: "POST",
      },
    );

    const rewritten = createJsonAuthRequest(request, {
      email: "merchant@example.com",
      name: "Merchant",
      password: "password123",
      privacyAcceptedAt: "2026-07-14T12:00:00.000Z",
      termsAcceptedAt: "2026-07-14T12:00:00.000Z",
    });

    expect(rewritten.url).toBe(
      "https://outpay.tech/api/auth/sign-up/email?source=signup",
    );
    expect(rewritten.method).toBe("POST");
    expect(rewritten.headers.get("content-type")).toBe("application/json");
    expect(rewritten.headers.get("content-length")).toBeNull();
    expect(rewritten.headers.get("transfer-encoding")).toBeNull();
    expect(rewritten.headers.get("x-request-id")).toBe(
      "signup-regression-test",
    );
    await expect(rewritten.json()).resolves.toMatchObject({
      privacyAcceptedAt: "2026-07-14T12:00:00.000Z",
      termsAcceptedAt: "2026-07-14T12:00:00.000Z",
    });
  });
});
