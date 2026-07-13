/**
 * Admin list endpoint for exhausted merchant webhook deliveries.
 */

import { adminErrorResponse } from "@/lib/admin/http";
import { listAdminWebhookFailures } from "@/lib/admin/server";
import { withRequestLogging } from "@/lib/logging/logger";

async function getAdminWebhookFailures(): Promise<Response> {
  try {
    return Response.json({ failures: await listAdminWebhookFailures() });
  } catch (error) {
    return adminErrorResponse(error, "ADMIN_WEBHOOK_FAILURES_LOAD_FAILED");
  }
}

export const GET = withRequestLogging(
  "/api/admin/webhook-failures GET",
  getAdminWebhookFailures,
);
