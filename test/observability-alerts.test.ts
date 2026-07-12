/**
 * Regression coverage for the operator alert transport and its secret boundary.
 */

import { afterEach, describe, expect, it } from "bun:test";
import { sendAlertNotification } from "@/lib/observability/alerts";
import type { AlertJobPayload } from "@/lib/queues/jobs";

const originalAlertUrl = process.env.OUTPAY_ALERT_WEBHOOK_URL;
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalAlertUrl === undefined) {
    delete process.env.OUTPAY_ALERT_WEBHOOK_URL;
  } else {
    process.env.OUTPAY_ALERT_WEBHOOK_URL = originalAlertUrl;
  }
});

describe("critical alert notifications", () => {
  it("posts a Slack-compatible message without forwarding secret metadata", async () => {
    process.env.OUTPAY_ALERT_WEBHOOK_URL =
      "https://hooks.slack.test/services/secret-path";
    let requestBody = "";

    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(null, { status: 204 });
    };

    const alert: AlertJobPayload = {
      dedupeKey: "database-connection-error",
      message: "Database connection failed.",
      metadata: { password: "must-not-leave-process", token: "secret-token" },
      severity: "critical",
      source: "database",
    };

    await expect(sendAlertNotification(alert)).resolves.toBe(true);
    expect(requestBody).toContain("Database connection failed.");
    expect(requestBody).not.toContain("must-not-leave-process");
    expect(requestBody).not.toContain("secret-token");
  });

  it("degrades safely when no operator webhook is configured", async () => {
    delete process.env.OUTPAY_ALERT_WEBHOOK_URL;

    await expect(
      sendAlertNotification({
        dedupeKey: "queue-backlog:payment-matching",
        message: "Queue backlog threshold exceeded.",
        severity: "critical",
        source: "queue",
      }),
    ).resolves.toBe(false);
  });
});
