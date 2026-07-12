import { jsonError } from "@/lib/dashboard/http";
import { withRequestLogging } from "@/lib/logging/logger";
import { getPublicCheckoutData } from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  getClientIp,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Public checkout status API used by the hosted checkout page.
 */
async function getPublicCheckout(
  request: Request,
  context: RouteContext<"/api/public/checkouts/[id]">,
) {
  try {
    const { id } = await context.params;
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.publicCheckoutStatus,
        resourceId: id,
        scopeType: "ip",
        scopeValue: getClientIp(request),
      }),
      policy: RATE_LIMIT_POLICIES.publicCheckoutStatus,
      routeId: "/api/public/checkouts/[id] GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.publicCheckoutStatus,
        rateLimit.retryAfterSeconds,
      );
    }

    return Response.json(await getPublicCheckoutData(id));
  } catch (error) {
    return jsonError(
      404,
      "PUBLIC_CHECKOUT_NOT_FOUND",
      error instanceof Error ? error.message : "Checkout not found.",
    );
  }
}

export const GET = withRequestLogging(
  "/api/public/checkouts/[id] GET",
  getPublicCheckout,
);
