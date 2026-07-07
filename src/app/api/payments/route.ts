import { jsonError } from "@/lib/dashboard/http";
import { getPaymentsPageData } from "@/lib/dashboard/server";

/**
 * Merchant payments ledger API with server-side filtering and pagination.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const data = await getPaymentsPageData({
      dateRange:
        (url.searchParams.get("dateRange") as
          | "7d"
          | "30d"
          | "90d"
          | "all"
          | null) ?? undefined,
      page: Number(url.searchParams.get("page") ?? "1"),
      search: url.searchParams.get("search") ?? "",
      status:
        (url.searchParams.get("status") as
          | "all"
          | "paid"
          | "pending"
          | "failed"
          | "expired"
          | null) ?? undefined,
    });

    return Response.json(data);
  } catch (error) {
    return jsonError(
      400,
      "PAYMENTS_LOAD_FAILED",
      error instanceof Error ? error.message : "Unable to load payments.",
    );
  }
}
