/**
 * Critical-condition notification transport for Outpay.
 *
 * The first backend is an operator-configured Slack-compatible webhook. The
 * transport is deliberately independent from PostgreSQL so database failures
 * can still notify an operator. `OUTPAY_ALERT_WEBHOOK_URL` is never included
 * in logs or alert payloads.
 */

import { logger } from "@/lib/logging/logger";
import type { AlertJobPayload } from "@/lib/queues/jobs";

const ALERT_TIMEOUT_MS = 5_000;

/**
 * Sends an operator alert when the webhook transport is configured.
 *
 * Parameters:
 * - alert: Architecture-defined alert payload.
 *
 * Returns:
 * - `true` when the webhook accepted the notification, otherwise `false`.
 *
 * Failure handling:
 * - Missing configuration is a warning and a safe no-op for local development.
 * - Network or non-2xx failures are logged without the webhook URL and return
 *   `false`; queue workers can then retry the alert job.
 */
export async function sendAlertNotification(
  alert: AlertJobPayload,
): Promise<boolean> {
  const webhookUrl = process.env.OUTPAY_ALERT_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    logger.warn(
      {
        alert_source: alert.source,
        alert_severity: alert.severity,
        dedupe_key: alert.dedupeKey,
      },
      "Critical alert not sent because OUTPAY_ALERT_WEBHOOK_URL is not configured",
    );
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      body: JSON.stringify({
        text: `[${alert.severity.toUpperCase()}] ${alert.message}`,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.error(
        {
          alert_source: alert.source,
          alert_severity: alert.severity,
          response_status: response.status,
        },
        "Critical alert webhook returned a non-success response",
      );
      return false;
    }

    logger.info(
      {
        alert_source: alert.source,
        alert_severity: alert.severity,
        dedupe_key: alert.dedupeKey,
      },
      "Critical alert notification sent",
    );
    return true;
  } catch (error) {
    logger.error(
      {
        alert_source: alert.source,
        alert_severity: alert.severity,
        err: error,
      },
      "Critical alert webhook request failed",
    );
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reports a database connection failure through the independent alert path.
 * This is best effort because the original database operation is already
 * failing and the request must retain its actionable application error.
 */
export function reportDatabaseConnectionFailure(error: unknown): void {
  const alert: AlertJobPayload = {
    dedupeKey: "database-connection-error",
    message: "Outpay could not establish a PostgreSQL connection.",
    metadata: { error: error instanceof Error ? error.message : String(error) },
    severity: "critical",
    source: "database",
  };

  void sendAlertNotification(alert);
}
