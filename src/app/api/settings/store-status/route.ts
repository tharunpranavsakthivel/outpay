import { jsonError } from "@/lib/dashboard/http";
import {
  deactivateStore,
  ForbiddenRoleError,
  getCurrentMerchantIdForRateLimit,
} from "@/lib/dashboard/server";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/validation/http";
import { storeStatusBodySchema } from "@/lib/validation/routes";

/**
 * Merchant lifecycle API for store-wide status mutations.
 */
async function updateStoreStatus(request: Request) {
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

    const parsedBody = await parseJsonBody(request, storeStatusBodySchema);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    return Response.json(
      await deactivateStore({
        confirmationText: parsedBody.data.confirmationText,
      }),
    );
  } catch (error) {
    if (error instanceof ForbiddenRoleError) {
      return jsonError(403, error.code, error.message, undefined, error);
    }

    return jsonError(
      422,
      "STORE_STATUS_UPDATE_FAILED",
      error instanceof Error ? error.message : "Unable to update store status.",
      undefined,
      error,
    );
  }
}

export const POST = withRequestLogging(
  "/api/settings/store-status POST",
  updateStoreStatus,
);
