import { jsonError } from "@/lib/dashboard/http";
import {
  getCurrentMerchantIdForRateLimit,
  getPaymentsPageData,
} from "@/lib/dashboard/server";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";
import { parseQueryParams } from "@/lib/validation/http";
import { dashboardPaymentsQuerySchema } from "@/lib/validation/routes";

/**
 * Merchant payments ledger API with server-side filtering and pagination.
 */
async function getPayments(request: Request) {
  try {
    const url = new URL(request.url);
    const parsedQuery = parseQueryParams(
      url.searchParams,
      dashboardPaymentsQuerySchema,
    );

    if (!parsedQuery.success) {
      return parsedQuery.response;
    }

    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.paymentsList,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.paymentsList,
      routeId: "/api/payments GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.paymentsList,
        rateLimit.retryAfterSeconds,
      );
    }

    const data = await getPaymentsPageData({
      dateRange: parsedQuery.data.dateRange,
      page: parsedQuery.data.page,
      search: parsedQuery.data.search,
      status: parsedQuery.data.status,
    });

    return Response.json(data);
  } catch (error) {
    return jsonError(
      400,
      "PAYMENTS_LOAD_FAILED",
      error instanceof Error ? error.message : "Unable to load payments.",
      undefined,
      error,
    );
  }
}

export const GET = withRequestLogging("/api/payments GET", getPayments);
