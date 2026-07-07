import { jsonError } from "@/lib/dashboard/http";
import {
  getDashboardPageData,
  markNotificationsRead,
} from "@/lib/dashboard/server";

/**
 * Dashboard notifications API for listing and marking items as read.
 */
export async function GET() {
  try {
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
export async function POST(request: Request) {
  try {
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
