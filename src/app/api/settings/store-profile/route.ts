import { jsonError } from "@/lib/dashboard/http";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  getCurrentMerchantIdForRateLimit,
  getStoreSettingsData,
  updateStoreProfile,
} from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Merchant store profile API for reading and updating merchants table fields.
 */
async function getStoreProfile() {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/settings/store-profile GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    return Response.json(await getStoreSettingsData());
  } catch (error) {
    return jsonError(
      400,
      "STORE_SETTINGS_LOAD_FAILED",
      error instanceof Error ? error.message : "Unable to load store settings.",
    );
  }
}

/**
 * Updates merchant profile fields that map directly to the schema.
 */
async function updateStoreProfileHandler(request: Request) {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/settings/store-profile PATCH",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const body = (await request.json()) as {
      description?: string;
      storeName?: string;
      supportEmail?: string;
      websiteUrl?: string;
    };

    return Response.json(
      await updateStoreProfile({
        description: body.description ?? "",
        storeName: body.storeName ?? "",
        supportEmail: body.supportEmail ?? "",
        websiteUrl: body.websiteUrl ?? "",
      }),
    );
  } catch (error) {
    return jsonError(
      422,
      "STORE_PROFILE_UPDATE_FAILED",
      error instanceof Error
        ? error.message
        : "Unable to update merchant profile.",
    );
  }
}

export const GET = withRequestLogging(
  "/api/settings/store-profile GET",
  getStoreProfile,
);
export const PATCH = withRequestLogging(
  "/api/settings/store-profile PATCH",
  updateStoreProfileHandler,
);
