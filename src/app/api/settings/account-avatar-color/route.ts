import { jsonError } from "@/lib/dashboard/http";
import {
  getCurrentMerchantIdForRateLimit,
  updateAccountAvatarColor,
} from "@/lib/dashboard/server";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Persists the signed-in user's initials-avatar background color.
 */
async function handleUpdateAccountAvatarColor(request: Request) {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/settings/account-avatar-color PATCH",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const body = (await request.json()) as { avatarColor?: string };

    return Response.json(
      await updateAccountAvatarColor({
        avatarColor: body.avatarColor ?? "",
      }),
    );
  } catch (error) {
    return jsonError(
      422,
      "AVATAR_COLOR_UPDATE_FAILED",
      error instanceof Error ? error.message : "Unable to update avatar color.",
      undefined,
      error,
    );
  }
}

export const PATCH = withRequestLogging(
  "/api/settings/account-avatar-color PATCH",
  handleUpdateAccountAvatarColor,
);
