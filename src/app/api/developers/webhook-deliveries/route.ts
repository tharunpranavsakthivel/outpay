import { jsonError } from "@/lib/dashboard/http";
import { getDevelopersPageData } from "@/lib/dashboard/server";

/**
 * Developers delivery history API backed by webhook_events and attempts.
 */
export async function GET() {
  try {
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
