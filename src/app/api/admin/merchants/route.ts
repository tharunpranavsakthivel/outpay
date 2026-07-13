/**
 * Admin merchant search endpoint.
 */

import { adminErrorResponse } from "@/lib/admin/http";
import { searchAdminMerchants } from "@/lib/admin/server";
import { withRequestLogging } from "@/lib/logging/logger";
import { parseQueryParams } from "@/lib/validation/http";
import { adminSearchQuerySchema } from "@/lib/validation/routes";

async function getAdminMerchants(request: Request): Promise<Response> {
  try {
    const parsedQuery = parseQueryParams(
      new URL(request.url).searchParams,
      adminSearchQuerySchema,
    );

    if (!parsedQuery.success) {
      return parsedQuery.response;
    }

    return Response.json({
      merchants: await searchAdminMerchants(parsedQuery.data.search),
    });
  } catch (error) {
    return adminErrorResponse(error, "ADMIN_MERCHANTS_LOAD_FAILED");
  }
}

export const GET = withRequestLogging(
  "/api/admin/merchants GET",
  getAdminMerchants,
);
