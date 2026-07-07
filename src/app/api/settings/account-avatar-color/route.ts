import { jsonError } from "@/lib/dashboard/http";
import { updateAccountAvatarColor } from "@/lib/dashboard/server";

/**
 * Persists the signed-in user's initials-avatar background color.
 */
export async function PATCH(request: Request) {
  try {
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
    );
  }
}
