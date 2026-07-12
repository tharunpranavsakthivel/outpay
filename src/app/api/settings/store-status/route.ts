import { jsonError } from "@/lib/dashboard/http";
import {
  deactivateStore,
  getCurrentMerchantIdForRateLimit,
} from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Merchant lifecycle API for store-wide status mutations.
 */
export async function POST(request: Request) {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/settings/store-status POST",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const body = (await request.json()) as {
      action?: string;
      confirmationText?: string;
    };

    if (body.action !== "deactivate") {
      return jsonError(
        400,
        "UNSUPPORTED_STORE_ACTION",
        "Only the deactivate action is supported on this route.",
      );
    }

    return Response.json(
      await deactivateStore({
        confirmationText: body.confirmationText ?? "",
      }),
    );
  } catch (error) {
    return jsonError(
      422,
      "STORE_STATUS_UPDATE_FAILED",
      error instanceof Error ? error.message : "Unable to update store status.",
    );
  }
}
