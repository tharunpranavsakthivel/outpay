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

    const { checkoutRef } = await context.params;
    const body = (await request.json()) as { action?: string };

    if (body.action !== "deactivate") {
      return jsonError(
        400,
        "UNSUPPORTED_CHECKOUT_ACTION",
        "Only the deactivate action is supported on this route.",
      );
    }

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
