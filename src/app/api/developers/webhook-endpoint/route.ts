import { jsonError } from "@/lib/dashboard/http";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  getCurrentMerchantIdForRateLimit,
  getDevelopersPageData,
  queueTestWebhookDelivery,
  upsertWebhookEndpoint,
} from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Developers webhook endpoint API for reading, configuring, and testing the
 * merchant's signed webhook destination.
 */
async function getWebhookEndpoint() {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/developers/webhook-endpoint GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const data = await getDevelopersPageData();

    return Response.json({
      webhookSecretPrefix: data.webhookSecretPrefix,
      webhookStatus: data.webhookStatus,
      webhookUrl: data.webhookUrl,
    });
  } catch (error) {
    return jsonError(
      400,
      "WEBHOOK_ENDPOINT_LOAD_FAILED",
      error instanceof Error ? error.message : "Unable to load webhook data.",
    );
  }
}

/**
 * Upserts the live webhook endpoint and rotates its secret.
 */
async function updateWebhookEndpoint(request: Request) {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/developers/webhook-endpoint PUT",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const body = (await request.json()) as { url?: string };
    return Response.json(
      await upsertWebhookEndpoint({
        url: body.url ?? "",
      }),
    );
  } catch (error) {
    return jsonError(
      422,
      "WEBHOOK_ENDPOINT_UPDATE_FAILED",
      error instanceof Error
        ? error.message
        : "Unable to update the webhook endpoint.",
    );
  }
}

/**
 * Queues a test webhook delivery entry for the current merchant.
 */
async function sendWebhookTest() {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.webhookTest,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.webhookTest,
      routeId: "/api/developers/webhook-endpoint POST",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.webhookTest,
        rateLimit.retryAfterSeconds,
      );
    }

    return Response.json(await queueTestWebhookDelivery(), {
      status: 202,
    });
  } catch (error) {
    return jsonError(
      422,
      "WEBHOOK_TEST_FAILED",
      error instanceof Error
        ? error.message
        : "Unable to queue a test webhook delivery.",
    );
  }
}

export const GET = withRequestLogging(
  "/api/developers/webhook-endpoint GET",
  getWebhookEndpoint,
);
export const PUT = withRequestLogging(
  "/api/developers/webhook-endpoint PUT",
  updateWebhookEndpoint,
);
export const POST = withRequestLogging(
  "/api/developers/webhook-endpoint POST",
  sendWebhookTest,
);
