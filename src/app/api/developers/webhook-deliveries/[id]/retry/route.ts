import { jsonError } from "@/lib/dashboard/http";
import {
  getCurrentMerchantIdForRateLimit,
  retryWebhookDelivery,
} from "@/lib/dashboard/server";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";
import { parseRouteParams } from "@/lib/validation/http";
import { idParamsSchema } from "@/lib/validation/routes";

/**
 * Manual retry API for a previously exhausted merchant webhook delivery.
 */
async function handleRetryWebhookDelivery(
  _request: Request,
  context: { params: Promise<{ id: string }> },
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
      routeId: "/api/developers/webhook-deliveries/[id]/retry POST",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const parsedParams = parseRouteParams(await context.params, idParamsSchema);

    if (!parsedParams.success) {
      return parsedParams.response;
    }

    return Response.json(
      await retryWebhookDelivery({
        deliveryAttemptId: parsedParams.data.id,
      }),
      {
        status: 202,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to retry the webhook delivery.";
    const status = message.includes("not found") ? 404 : 422;

    return jsonError(
      status,
      "WEBHOOK_DELIVERY_RETRY_FAILED",
      message,
      undefined,
      error,
    );
  }
}

export const POST = withRequestLogging(
  "/api/developers/webhook-deliveries/[id]/retry POST",
  handleRetryWebhookDelivery,
);
