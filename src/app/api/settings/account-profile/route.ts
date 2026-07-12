import { jsonError } from "@/lib/dashboard/http";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  getAccountSettingsData,
  getCurrentMerchantIdForRateLimit,
  updateAccountProfile,
} from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Account profile API backed by user_profiles.
 */
async function getAccountProfile() {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/settings/account-profile GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    return Response.json(await getAccountSettingsData());
  } catch (error) {
    return jsonError(
      400,
      "ACCOUNT_SETTINGS_LOAD_FAILED",
      error instanceof Error ? error.message : "Unable to load account data.",
    );
  }
}

/**
 * Updates mutable user profile fields used by the dashboard.
 */
async function updateAccountProfile(request: Request) {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/settings/account-profile PATCH",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const body = (await request.json()) as {
      fullName?: string;
    };

    return Response.json(
      await updateAccountProfile({
        fullName: body.fullName ?? "",
      }),
    );
  } catch (error) {
    return jsonError(
      422,
      "ACCOUNT_PROFILE_UPDATE_FAILED",
      error instanceof Error ? error.message : "Unable to update account.",
    );
  }
}

export const GET = withRequestLogging(
  "/api/settings/account-profile GET",
  getAccountProfile,
);
export const PATCH = withRequestLogging(
  "/api/settings/account-profile PATCH",
  updateAccountProfile,
);
