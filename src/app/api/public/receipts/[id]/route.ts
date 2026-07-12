import { jsonError } from "@/lib/dashboard/http";
import { getPublicReceiptData } from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  getClientIp,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Public receipt API used by the hosted receipt page.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/public/receipts/[id]">,
) {
  try {
    const { id } = await context.params;
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultPublicRoute,
        scopeType: "ip",
        scopeValue: getClientIp(request),
      }),
      policy: RATE_LIMIT_POLICIES.defaultPublicRoute,
      routeId: "/api/public/receipts/[id] GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultPublicRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    return Response.json(await getPublicReceiptData(id));
  } catch (error) {
    return jsonError(
      404,
      "PUBLIC_RECEIPT_NOT_FOUND",
      error instanceof Error ? error.message : "Receipt not found.",
    );
  }
}
