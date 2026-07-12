import { jsonError } from "@/lib/dashboard/http";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  getCurrentMerchantIdForRateLimit,
  getDevelopersPageData,
} from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Developers delivery history API backed by webhook_events and attempts.
 */
async function getWebhookDeliveries() {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/developers/webhook-deliveries GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const data = await getDevelopersPageData();
    return Response.json({
      lastWebhookPayload: data.lastWebhookPayload,
      webhookDeliveries: data.webhookDeliveries,
    });
  } catch (error) {
    return jsonError(
      400,
      "WEBHOOK_DELIVERIES_LOAD_FAILED",
      error instanceof Error
        ? error.message
        : "Unable to load webhook delivery history.",
    );
  }
}

export const GET = withRequestLogging(
  "/api/developers/webhook-deliveries GET",
  getWebhookDeliveries,
);
