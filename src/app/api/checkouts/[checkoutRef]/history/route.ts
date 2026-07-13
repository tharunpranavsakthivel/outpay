import { jsonError } from "@/lib/dashboard/http";
import {
  getCheckoutStatusHistory,
  getCurrentMerchantIdForRateLimit,
  MerchantCheckoutNotFoundError,
} from "@/lib/dashboard/server";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";
import { parseRouteParams } from "@/lib/validation/http";
import { checkoutParamsSchema } from "@/lib/validation/routes";

/**
 * Merchant-scoped checkout status-history API. The history query is tied to a
 * checkout session selected through the authenticated merchant context.
 */
async function getCheckoutHistory(
  _request: Request,
  context: { params: Promise<{ checkoutRef: string }> },
) {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/checkouts/[checkoutRef]/history GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const parsedParams = parseRouteParams(
      await context.params,
      checkoutParamsSchema,
    );

    if (!parsedParams.success) {
      return parsedParams.response;
    }

    return Response.json(
      await getCheckoutStatusHistory(parsedParams.data.checkoutRef),
    );
  } catch (error) {
    if (error instanceof MerchantCheckoutNotFoundError) {
      return jsonError(404, error.code, error.message, undefined, error);
    }

    return jsonError(
      422,
      "CHECKOUT_HISTORY_LOAD_FAILED",
      error instanceof Error
        ? error.message
        : "Unable to load checkout history.",
      undefined,
      error,
    );
  }
}

export const GET = withRequestLogging(
  "/api/checkouts/[checkoutRef]/history GET",
  getCheckoutHistory,
);
