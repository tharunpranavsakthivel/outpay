/**
 * Admin merchant lifecycle endpoint. Disabling requires an exact-name
 * confirmation and is audited with the acting admin profile UUID.
 */

import { adminErrorResponse } from "@/lib/admin/http";
import { disableAdminMerchant } from "@/lib/admin/server";
import { withRequestLogging } from "@/lib/logging/logger";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import {
  adminMerchantDisableBodySchema,
  idParamsSchema,
} from "@/lib/validation/routes";

async function disableMerchant(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const parsedParams = parseRouteParams(await context.params, idParamsSchema);

    if (!parsedParams.success) {
      return parsedParams.response;
    }

    const parsedBody = await parseJsonBody(
      request,
      adminMerchantDisableBodySchema,
    );

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    return Response.json(
      {
        merchant: await disableAdminMerchant({
          confirmationText: parsedBody.data.confirmationText,
          merchantId: parsedParams.data.id,
          reason: parsedBody.data.reason,
        }),
      },
      { status: 200 },
    );
  } catch (error) {
    return adminErrorResponse(error, "ADMIN_MERCHANT_DISABLE_FAILED");
  }
}

export const PATCH = withRequestLogging(
  "/api/admin/merchants/[id] PATCH",
  disableMerchant,
);
