/**
 * Admin provider-health endpoint backed by persisted health-check history.
 */

import { adminErrorResponse } from "@/lib/admin/http";
import { listAdminProviderHealth } from "@/lib/admin/server";
import { withRequestLogging } from "@/lib/logging/logger";

async function getAdminProviderHealth(): Promise<Response> {
  try {
    return Response.json({ healthChecks: await listAdminProviderHealth() });
  } catch (error) {
    return adminErrorResponse(error, "ADMIN_PROVIDER_HEALTH_LOAD_FAILED");
  }
}

export const GET = withRequestLogging(
  "/api/admin/provider-health GET",
  getAdminProviderHealth,
);
