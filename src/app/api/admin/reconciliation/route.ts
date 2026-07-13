/**
 * Admin endpoint for enqueueing a bounded manual reconciliation block scan.
 */

import { adminErrorResponse } from "@/lib/admin/http";
import { forceAdminReconciliation } from "@/lib/admin/server";
import { withRequestLogging } from "@/lib/logging/logger";
import { parseJsonBody } from "@/lib/validation/http";
import { adminReconciliationBodySchema } from "@/lib/validation/routes";

async function forceReconciliation(request: Request): Promise<Response> {
  try {
    const parsedBody = await parseJsonBody(
      request,
      adminReconciliationBodySchema,
    );

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    return Response.json(await forceAdminReconciliation(parsedBody.data), {
      status: 202,
    });
  } catch (error) {
    return adminErrorResponse(error, "ADMIN_RECONCILIATION_FAILED");
  }
}

export const POST = withRequestLogging(
  "/api/admin/reconciliation POST",
  forceReconciliation,
);
