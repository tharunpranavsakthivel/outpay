import { jsonError } from "@/lib/dashboard/http";
import {
  getCurrentMerchantIdForRateLimit,
  uploadStoreLogo,
} from "@/lib/dashboard/server";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";
import {
  ALLOWED_LOGO_CONTENT_TYPES,
  LOGO_MAX_BYTES,
} from "@/lib/storage/tigris";

/**
 * Uploads a new store logo for the signed-in user's merchant. Used by both
 * the onboarding flow (after the merchant is created) and Settings > Store
 * profile.
 */
async function handleUploadStoreLogo(request: Request) {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/settings/store-logo POST",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError(400, "FILE_REQUIRED", "Attach an image file to upload.");
    }

    if (!ALLOWED_LOGO_CONTENT_TYPES.has(file.type)) {
      return jsonError(
        415,
        "UNSUPPORTED_FILE_TYPE",
        "Upload a PNG, JPEG, WebP, or SVG image.",
      );
    }

    if (file.size > LOGO_MAX_BYTES) {
      return jsonError(
        413,
        "FILE_TOO_LARGE",
        `Images must be ${LOGO_MAX_BYTES / (1024 * 1024)}MB or smaller.`,
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { logoUrl } = await uploadStoreLogo({
      buffer,
      contentType: file.type,
    });

    return Response.json({ url: logoUrl });
  } catch (error) {
    return jsonError(
      422,
      "STORE_LOGO_UPLOAD_FAILED",
      error instanceof Error ? error.message : "Unable to upload store logo.",
      undefined,
      error,
    );
  }
}

export const POST = withRequestLogging(
  "/api/settings/store-logo POST",
  handleUploadStoreLogo,
);
