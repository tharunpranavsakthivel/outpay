import { jsonError } from "@/lib/dashboard/http";
import { retryWebhookDelivery } from "@/lib/dashboard/server";

/**
 * Manual retry API for a previously exhausted merchant webhook delivery.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    return Response.json(
      await retryWebhookDelivery({
        deliveryAttemptId: id,
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

    return jsonError(status, "WEBHOOK_DELIVERY_RETRY_FAILED", message);
  }
}
