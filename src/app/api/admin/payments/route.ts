/**
 * Admin payment search endpoint. Results intentionally cross merchant
 * boundaries only after the shared database-backed admin guard succeeds.
 */

import { adminErrorResponse } from "@/lib/admin/http";
import { searchAdminPayments } from "@/lib/admin/server";
import { withRequestLogging } from "@/lib/logging/logger";
import { parseQueryParams } from "@/lib/validation/http";
import { adminSearchQuerySchema } from "@/lib/validation/routes";

async function getAdminPayments(request: Request): Promise<Response> {
  try {
    const parsedQuery = parseQueryParams(
      new URL(request.url).searchParams,
      adminSearchQuerySchema,
    );

    if (!parsedQuery.success) {
      return parsedQuery.response;
    }

    return Response.json({
      payments: await searchAdminPayments(parsedQuery.data.search),
    });
  } catch (error) {
    return adminErrorResponse(error, "ADMIN_PAYMENTS_LOAD_FAILED");
  }
}

export const GET = withRequestLogging(
  "/api/admin/payments GET",
  getAdminPayments,
);
