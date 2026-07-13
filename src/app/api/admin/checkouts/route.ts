/**
 * Admin checkout search endpoint required by the architecture dashboard map.
 */

import { adminErrorResponse } from "@/lib/admin/http";
import { searchAdminCheckouts } from "@/lib/admin/server";
import { withRequestLogging } from "@/lib/logging/logger";
import { parseQueryParams } from "@/lib/validation/http";
import { adminSearchQuerySchema } from "@/lib/validation/routes";

async function getAdminCheckouts(request: Request): Promise<Response> {
  try {
    const parsedQuery = parseQueryParams(
      new URL(request.url).searchParams,
      adminSearchQuerySchema,
    );

    if (!parsedQuery.success) {
      return parsedQuery.response;
    }

    return Response.json({
      checkouts: await searchAdminCheckouts(parsedQuery.data.search),
    });
  } catch (error) {
    return adminErrorResponse(error, "ADMIN_CHECKOUTS_LOAD_FAILED");
  }
}

export const GET = withRequestLogging(
  "/api/admin/checkouts GET",
  getAdminCheckouts,
);
