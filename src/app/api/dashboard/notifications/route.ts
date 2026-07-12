import { jsonError } from "@/lib/dashboard/http";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  getCurrentMerchantIdForRateLimit,
  getDashboardPageData,
  markNotificationsRead,
} from "@/lib/dashboard/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

/**
 * Dashboard notifications API for listing and marking items as read.
 */
async function getNotifications() {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/dashboard/notifications GET",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const data = await getDashboardPageData();
    return Response.json({
      notifications: data.notifications,
      unreadNotifications: data.merchant.unreadNotifications,
    });
  } catch (error) {
    return jsonError(
      400,
      "NOTIFICATIONS_LOAD_FAILED",
      error instanceof Error ? error.message : "Unable to load notifications.",
    );
  }
}

/**
 * Marks the current merchant user's unread notifications as read.
 */
async function markNotificationsRead(request: Request) {
  try {
    const merchantId = await getCurrentMerchantIdForRateLimit();
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        scopeType: "merchant",
        scopeValue: merchantId,
      }),
      policy: RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
      routeId: "/api/dashboard/notifications POST",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.defaultAuthenticatedRoute,
        rateLimit.retryAfterSeconds,
      );
    }

    const body = (await request.json()) as { action?: string };

    if (body.action !== "mark-all-read") {
      return jsonError(
        400,
        "UNSUPPORTED_NOTIFICATION_ACTION",
        "Only the mark-all-read action is supported on this route.",
      );
    }

    await markNotificationsRead();
    return Response.json({
      ok: true,
    });
  } catch (error) {
    return jsonError(
      422,
      "NOTIFICATIONS_UPDATE_FAILED",
      error instanceof Error
        ? error.message
        : "Unable to update notifications.",
    );
  }
}

export const GET = withRequestLogging(
  "/api/dashboard/notifications GET",
  getNotifications,
);
export const POST = withRequestLogging(
  "/api/dashboard/notifications POST",
  markNotificationsRead,
);
