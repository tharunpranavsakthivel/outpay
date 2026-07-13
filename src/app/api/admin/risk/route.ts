/**
 * Admin risk-review endpoint backed by merchant_reviews.
 */

import { adminErrorResponse } from "@/lib/admin/http";
import { listAdminRisk } from "@/lib/admin/server";
import { withRequestLogging } from "@/lib/logging/logger";

async function getAdminRisk(): Promise<Response> {
  try {
    return Response.json({ reviews: await listAdminRisk() });
  } catch (error) {
    return adminErrorResponse(error, "ADMIN_RISK_LOAD_FAILED");
  }
}

export const GET = withRequestLogging("/api/admin/risk GET", getAdminRisk);
