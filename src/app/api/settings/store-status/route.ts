import { jsonError } from "@/lib/dashboard/http";
import { deactivateStore } from "@/lib/dashboard/server";

/**
 * Merchant lifecycle API for store-wide status mutations.
 */
export async function POST(request: Request) {
  try {
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
