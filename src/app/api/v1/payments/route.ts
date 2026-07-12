import {
  getPublicApiRequestId,
  publicApiError,
  publicApiJson,
} from "@/lib/api/public";
import { authenticateApiKeyRequest } from "@/lib/auth/api-key";
import { listMerchantPayments } from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createPublicApiRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Public v1 payment-list endpoint authenticated by merchant API keys.
 */
export async function GET(request: Request) {
  const requestId = getPublicApiRequestId(request);

  try {
    const auth = await authenticateApiKeyRequest(request);

    if (!auth) {
      return publicApiError(
        requestId,
        401,
        "INVALID_API_KEY",
        "Provide a valid API key in the Authorization header.",
      );
    }

    if (!auth.scopes.includes("payments:read")) {
      return publicApiError(
        requestId,
        403,
        "FORBIDDEN",
        "This API key does not include the payments:read scope.",
      );
    }

    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.paymentsList,
        scopeType: "merchant",
        scopeValue: auth.merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.paymentsList,
      routeId: "/api/v1/payments GET",
    });

    if (!rateLimit.allowed) {
      return createPublicApiRateLimitError({
        policy: RATE_LIMIT_POLICIES.paymentsList,
        requestId,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const url = new URL(request.url);
    const limitValue = Number(url.searchParams.get("limit") ?? "25");
    const status = url.searchParams.get("status");

    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100) {
      return publicApiError(
        requestId,
        400,
        "INVALID_LIMIT",
        "Limit must be an integer between 1 and 100.",
        [{ field: "limit", issue: "Value must be between 1 and 100." }],
      );
    }

    const payments = await listMerchantPayments({
      limit: limitValue,
      merchantId: auth.merchantId,
      status,
    });

    return publicApiJson(requestId, {
      data: payments,
    });
  } catch (error) {
    return publicApiError(
      requestId,
      500,
      "PAYMENTS_READ_FAILED",
      error instanceof Error ? error.message : "Unable to load payments.",
    );
  }
}
