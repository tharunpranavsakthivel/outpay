import { jsonError } from "@/lib/dashboard/http";
import {
  createDashboardCheckout,
  getCheckoutListPageData,
  getCurrentMerchantIdForRateLimit,
} from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Checkout collection API for listing and creating merchant checkout sessions.
 */
export async function GET() {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/checkouts GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const data = await getCheckoutListPageData();
    return Response.json(data);
  } catch (error) {
    return jsonError(
      400,
      "CHECKOUT_LIST_FAILED",
      error instanceof Error ? error.message : "Unable to load checkouts.",
    );
  }
}

/**
 * Creates a new checkout session and payment intent from dashboard form input.
 */
export async function POST(request: Request) {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.checkoutCreate,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.checkoutCreate,
      routeId: "/api/checkouts POST",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.checkoutCreate,
        rateLimit.retryAfterSeconds,
      );
    }

    const body = (await request.json()) as {
      amountUsd?: string;
      label?: string;
      orderReference?: string;
      redirectUrl?: string;
    };
    const result = await createDashboardCheckout({
      amountUsd: body.amountUsd ?? "",
      label: body.label ?? "",
      orderReference: body.orderReference ?? "",
      redirectUrl: body.redirectUrl ?? "",
    });

    return Response.json(result, {
      status: 201,
    });
  } catch (error) {
    return jsonError(
      422,
      "CHECKOUT_CREATE_FAILED",
      error instanceof Error ? error.message : "Unable to create checkout.",
    );
  }
}
