/**
 * Admin-only manual retry endpoint for one exhausted webhook delivery.
 */

import { adminErrorResponse } from "@/lib/admin/http";
import { retryAdminWebhook } from "@/lib/admin/server";
import { withRequestLogging } from "@/lib/logging/logger";
import { parseRouteParams } from "@/lib/validation/http";
import { idParamsSchema } from "@/lib/validation/routes";

async function retryWebhook(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const parsedParams = parseRouteParams(await context.params, idParamsSchema);

    if (!parsedParams.success) {
      return parsedParams.response;
    }

    return Response.json(await retryAdminWebhook(parsedParams.data.id), {
      status: 202,
    });
  } catch (error) {
    return adminErrorResponse(error, "ADMIN_WEBHOOK_RETRY_FAILED");
  }
}

export const POST = withRequestLogging(
  "/api/admin/webhook-failures/[id]/retry POST",
  retryWebhook,
);
