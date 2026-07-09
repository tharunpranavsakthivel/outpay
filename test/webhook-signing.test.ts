/**
 * Unit tests for outbound merchant webhook signing helpers.
 */

import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import {
  buildSignedWebhookHeaders,
  OUTPAY_WEBHOOK_HEADER_NAMES,
  signPayload,
} from "@/lib/webhooks/sign";

describe("webhook signing", () => {
  it("builds the expected v1 HMAC signature", () => {
    const secret = "whsec_test_secret";
    const timestamp = "1783520000";
    const body = JSON.stringify({
      amount: "42.00",
      checkout_ref: "chk_123",
      event: "checkout.paid",
    });
    const expectedDigest = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(signPayload(secret, timestamp, body)).toBe(`v1=${expectedDigest}`);
  });

  it("uses the X-Outpay header set for signed delivery", () => {
    const headers = buildSignedWebhookHeaders({
      body: '{"event":"checkout.paid"}',
      deliveryId: "whd_123",
      eventType: "checkout.paid",
      secret: "whsec_example",
      timestamp: "1783520000",
    });

    expect(headers).toMatchObject({
      "Content-Type": "application/json",
      "User-Agent": "Outpay-Webhooks/1.0",
      [OUTPAY_WEBHOOK_HEADER_NAMES.deliveryId]: "whd_123",
      [OUTPAY_WEBHOOK_HEADER_NAMES.event]: "checkout.paid",
      [OUTPAY_WEBHOOK_HEADER_NAMES.timestamp]: "1783520000",
    });
    expect(headers[OUTPAY_WEBHOOK_HEADER_NAMES.signature]).toMatch(/^v1=/);
  });
});
