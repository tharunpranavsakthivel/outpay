import { jsonError } from "@/lib/dashboard/http";
import { getPublicReceiptData } from "@/lib/dashboard/server";

/**
 * Public receipt API used by the hosted receipt page.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/public/receipts/[id]">,
) {
  try {
    const { id } = await context.params;
    return Response.json(await getPublicReceiptData(id));
  } catch (error) {
    return jsonError(
      404,
      "PUBLIC_RECEIPT_NOT_FOUND",
      error instanceof Error ? error.message : "Receipt not found.",
    );
  }
}
