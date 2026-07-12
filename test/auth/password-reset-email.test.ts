/**
 * Provider-boundary tests for password-reset transactional email delivery.
 *
 * The provider call is sandboxed at the native fetch boundary so tests prove
 * the exact Resend request without sending mail or requiring live credentials.
 */

import { afterEach, describe, expect, it } from "bun:test";
import { EmailDeliveryError, sendResetPasswordEmail } from "@/lib/email/send";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.OUTPAY_EMAIL_FROM;

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalApiKey === undefined) {
    delete process.env.RESEND_API_KEY;
  } else {
    process.env.RESEND_API_KEY = originalApiKey;
  }

  if (originalFrom === undefined) {
    delete process.env.OUTPAY_EMAIL_FROM;
  } else {
    process.env.OUTPAY_EMAIL_FROM = originalFrom;
  }
});

describe("password-reset email delivery", () => {
  it("triggers the sandboxed Resend provider with Better Auth's reset URL", async () => {
    process.env.RESEND_API_KEY = "re_test_provider_key";
    process.env.OUTPAY_EMAIL_FROM = "Outpay <noreply@example.com>";

    let request: {
      body: string;
      headers: Headers;
      input: RequestInfo | URL;
    } | null = null;
    globalThis.fetch = async (input, init) => {
      request = {
        body: String(init?.body),
        headers: new Headers(init?.headers),
        input,
      };

      return new Response(JSON.stringify({ id: "email_test_123" }), {
        status: 200,
      });
    };

    const result = await sendResetPasswordEmail({
      email: "merchant@example.com",
      name: "Ada Merchant",
      url: "http://localhost:3001/api/auth/reset-password/token_123?callbackURL=%2Fforgot",
    });

    expect(result).toEqual({ id: "email_test_123" });
    expect(request).not.toBeNull();
    expect(String(request?.input)).toBe("https://api.resend.com/emails");
    expect(request?.headers.get("authorization")).toBe(
      "Bearer re_test_provider_key",
    );

    const body = JSON.parse(request?.body ?? "{}") as {
      html: string;
      subject: string;
      text: string;
      to: string[];
    };
    expect(body.to).toEqual(["merchant@example.com"]);
    expect(body.subject).toBe("Reset your Outpay password");
    expect(body.html).toContain("Reset your Outpay password");
    expect(body.html).toContain("token_123");
    expect(body.text).toContain(
      "http://localhost:3001/api/auth/reset-password/token_123",
    );
  });

  it("raises a provider error without exposing the API response body", async () => {
    process.env.RESEND_API_KEY = "re_test_provider_key";
    process.env.OUTPAY_EMAIL_FROM = "Outpay <noreply@example.com>";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "provider secret details" }), {
        status: 422,
      });

    let error: unknown;

    try {
      await sendResetPasswordEmail({
        email: "merchant@example.com",
        name: "Ada Merchant",
        url: "https://outpay.example/reset/token_123",
      });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect((error as Error).message).toBe(
      "Resend rejected the email request with HTTP 422.",
    );
    expect((error as Error).message).not.toContain("provider secret details");
  });
});
