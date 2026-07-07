import { jsonError } from "@/lib/dashboard/http";
import {
  getDevelopersPageData,
  queueTestWebhookDelivery,
  upsertWebhookEndpoint,
} from "@/lib/dashboard/server";

/**
 * Developers webhook endpoint API for reading, configuring, and testing the
 * merchant's signed webhook destination.
 */
export async function GET() {
  try {
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
export async function PUT(request: Request) {
  try {
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
export async function POST() {
  try {
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
