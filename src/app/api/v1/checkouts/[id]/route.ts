import {
  getPublicApiRequestId,
  publicApiError,
  publicApiJson,
} from "@/lib/api/public";
import { withRequestLogging } from "@/lib/logging/logger";
import { authenticateApiKeyRequest } from "@/lib/auth/api-key";
import { getMerchantCheckoutStatus } from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createPublicApiRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Public v1 checkout-read endpoint authenticated by merchant API keys.
 */
async function getApiCheckout(
  request: Request,
  context: RouteContext<"/api/v1/checkouts/[id]">,
) {
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

    const hasReadScope =
      auth.scopes.includes("checkouts:read") ||
      auth.scopes.includes("payments:read");

    if (!hasReadScope) {
      return publicApiError(
        requestId,
        403,
        "FORBIDDEN",
        "This API key does not include a checkout or payment read scope.",
      );
    }

    const { id } = await context.params;
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.checkoutRead,
        scopeType: "merchant",
        scopeValue: auth.merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.checkoutRead,
      routeId: "/api/v1/checkouts/[id] GET",
    });

    if (!rateLimit.allowed) {
      return createPublicApiRateLimitError({
        policy: RATE_LIMIT_POLICIES.checkoutRead,
        requestId,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const checkout = await getMerchantCheckoutStatus(auth.merchantId, id);

    if (!checkout) {
      return publicApiError(
        requestId,
        404,
        "CHECKOUT_NOT_FOUND",
        "No checkout was found for the supplied identifier.",
      );
    }

    return publicApiJson(requestId, {
      amount: checkout.amount,
      cancelUrl: checkout.cancelUrl,
      chain: checkout.chain,
      currency: checkout.currency,
      customerEmail: checkout.customerEmail,
      expiresAt: checkout.expiresAt,
      id: checkout.checkoutRef,
      metadata: checkout.metadata,
      payment: checkout.payment,
      paymentUrl: new URL(checkout.paymentUrlPath, request.url).toString(),
      recipient: checkout.recipient,
      status: checkout.status,
      successUrl: checkout.successUrl,
    });
  } catch (error) {
    return publicApiError(
      requestId,
      500,
      "CHECKOUT_READ_FAILED",
      error instanceof Error ? error.message : "Unable to load the checkout.",
    );
  }
}

export const GET = withRequestLogging(
  "/api/v1/checkouts/[id] GET",
  getApiCheckout,
);
