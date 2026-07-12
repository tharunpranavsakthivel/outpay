import { jsonError } from "@/lib/dashboard/http";
import {
  deactivateCheckout,
  getCurrentMerchantIdForRateLimit,
} from "@/lib/dashboard/server";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import {
  checkoutActionBodySchema,
  checkoutParamsSchema,
} from "@/lib/validation/routes";

/**
 * Single-checkout mutation API for status changes such as deactivation.
 */
async function patchCheckout(
  request: Request,
  context: RouteContext<"/api/checkouts/[checkoutRef]">,
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
      routeId: "/api/checkouts/[checkoutRef] PATCH",
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

    const parsedBody = await parseJsonBody(request, checkoutActionBodySchema);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { checkoutRef } = parsedParams.data;
    const result = await deactivateCheckout(checkoutRef);
    return Response.json(result);
  } catch (error) {
    return jsonError(
      422,
      "CHECKOUT_UPDATE_FAILED",
      error instanceof Error ? error.message : "Unable to update checkout.",
      undefined,
      error,
    );
  }
}

export const PATCH = withRequestLogging(
  "/api/checkouts/[checkoutRef] PATCH",
  patchCheckout,
);
