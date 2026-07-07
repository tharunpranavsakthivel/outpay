import { jsonError } from "@/lib/dashboard/http";
import { deactivateCheckout } from "@/lib/dashboard/server";

/**
 * Single-checkout mutation API for status changes such as deactivation.
 */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/checkouts/[checkoutRef]">,
) {
  try {
    const { checkoutRef } = await context.params;
    const body = (await request.json()) as { action?: string };

    if (body.action !== "deactivate") {
      return jsonError(
        400,
        "UNSUPPORTED_CHECKOUT_ACTION",
        "Only the deactivate action is supported on this route.",
      );
    }

    const result = await deactivateCheckout(checkoutRef);
    return Response.json(result);
  } catch (error) {
    return jsonError(
      422,
      "CHECKOUT_UPDATE_FAILED",
      error instanceof Error ? error.message : "Unable to update checkout.",
    );
  }
}
