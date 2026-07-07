import { jsonError } from "@/lib/dashboard/http";
import { getPublicCheckoutData } from "@/lib/dashboard/server";

/**
 * Public checkout status API used by the hosted checkout page.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/public/checkouts/[id]">,
) {
  try {
    const { id } = await context.params;
    return Response.json(await getPublicCheckoutData(id));
  } catch (error) {
    return jsonError(
      404,
      "PUBLIC_CHECKOUT_NOT_FOUND",
      error instanceof Error ? error.message : "Checkout not found.",
    );
  }
}
