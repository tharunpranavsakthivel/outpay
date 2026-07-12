import { jsonError } from "@/lib/dashboard/http";
import {
  getCurrentMerchantIdForRateLimit,
  getPaymentsPageData,
} from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Merchant payments ledger API with server-side filtering and pagination.
 */
export async function GET(request: Request) {
  try {
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

    const url = new URL(request.url);
    const data = await getPaymentsPageData({
      dateRange:
        (url.searchParams.get("dateRange") as
          | "7d"
          | "30d"
          | "90d"
          | "all"
          | null) ?? undefined,
      page: Number(url.searchParams.get("page") ?? "1"),
      search: url.searchParams.get("search") ?? "",
      status:
        (url.searchParams.get("status") as
          | "all"
          | "paid"
          | "pending"
          | "failed"
          | "expired"
          | null) ?? undefined,
    });

    return Response.json(data);
  } catch (error) {
    return jsonError(
      400,
      "PAYMENTS_LOAD_FAILED",
      error instanceof Error ? error.message : "Unable to load payments.",
    );
  }
}
