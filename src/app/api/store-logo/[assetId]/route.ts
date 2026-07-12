import { getStoreLogoObject } from "@/lib/dashboard/server";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  getClientIp,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Streams the current active merchant's raster logo. Replaced and orphaned
 * asset IDs are intentionally not served, even when the caller knows them.
 */
async function getStoreLogo(
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
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const GET = withRequestLogging(
  "/api/store-logo/[assetId] GET",
  getStoreLogo,
);
