/**
 * Public store-directory API. It returns only active merchants that opted into
 * discovery and only the fields intended for anonymous directory visitors.
 */

import { z } from "zod";
import { jsonError } from "@/lib/dashboard/http";
import { getPublicStoreDirectory } from "@/lib/dashboard/server";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  getClientIp,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";
import { parseQueryParams } from "@/lib/validation/http";

const publicStoresQuerySchema = z.object({
  limit: z.coerce.number().finite().int().min(1).max(100).default(100),
  search: z.string().trim().max(200).default(""),
});

/**
 * Lists active, opted-in stores for anonymous discovery.
 *
 * Parameters:
 * - request: Incoming request used for query parsing and IP-scoped limiting.
 *
 * Returns:
 * - JSON directory payload or a standard validation/rate-limit/error envelope.
 */
async function getPublicStores(request: Request) {
  try {
    const parsedQuery = parseQueryParams(
      new URL(request.url).searchParams,
      publicStoresQuerySchema,
    );

    if (!parsedQuery.success) {
      return parsedQuery.response;
    }

    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultPublicRoute,
        scopeType: "ip",
        scopeValue: getClientIp(request),
      }),
      policy: RATE_LIMIT_POLICIES.defaultPublicRoute,
      routeId: "/api/public/stores GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultPublicRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    return Response.json(await getPublicStoreDirectory(parsedQuery.data));
  } catch (error) {
    return jsonError(
      500,
      "PUBLIC_STORES_LOAD_FAILED",
      "Unable to load the store directory. Try again shortly.",
      undefined,
      error,
    );
  }
}

export const GET = withRequestLogging(
  "/api/public/stores GET",
  getPublicStores,
);
