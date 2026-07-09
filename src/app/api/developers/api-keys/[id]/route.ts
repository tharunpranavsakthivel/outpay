import { jsonError } from "@/lib/dashboard/http";
import { revokeApiKey } from "@/lib/dashboard/server";

/**
 * Developers API key mutation route for merchant-scoped lifecycle actions.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const body = (await request.json()) as {
      action?: string;
    };

    if (body.action !== "revoke") {
      return jsonError(
        400,
        "INVALID_API_KEY_ACTION",
        "API key action must be revoke.",
      );
    }

    const { id } = await context.params;

    return Response.json(
      {
        apiKey: await revokeApiKey({
          apiKeyId: id,
        }),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update the API key.";
    const status = message.includes("not found") ? 404 : 422;

    return jsonError(status, "API_KEY_UPDATE_FAILED", message);
  }
}
