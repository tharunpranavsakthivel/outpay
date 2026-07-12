import { getStoreLogoObject } from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  getClientIp,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Streams a store logo asset. Each asset ID is unique per upload, so the
 * response can be cached forever.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const rateLimit = await consumeRateLimit({
    key: buildRateLimitKey({
      policy: RATE_LIMIT_POLICIES.defaultPublicRoute,
      scopeType: "ip",
      scopeValue: getClientIp(request),
    }),
    policy: RATE_LIMIT_POLICIES.defaultPublicRoute,
    routeId: "/api/store-logo/[assetId] GET",
  });

  if (!rateLimit.allowed) {
    return createJsonRateLimitError(
      RATE_LIMIT_POLICIES.defaultPublicRoute,
      rateLimit.retryAfterSeconds,
    );
  }

  const { assetId } = await params;
  const asset = await getStoreLogoObject(assetId);

  if (!asset) {
    return new Response(null, { status: 404 });
  }

  return new Response(Buffer.from(asset.buffer), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": asset.contentType,
    },
  });
}
