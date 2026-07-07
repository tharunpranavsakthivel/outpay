import { jsonError } from "@/lib/dashboard/http";
import {
  getAccountSettingsData,
  updateAccountProfile,
} from "@/lib/dashboard/server";

/**
 * Account profile API backed by user_profiles.
 */
export async function GET() {
  try {
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
export async function PATCH(request: Request) {
  try {
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
