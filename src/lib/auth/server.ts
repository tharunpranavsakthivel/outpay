/**
 * Request-scoped Better Auth helpers for Server Components and server-side
 * data loaders.
 */

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Returns the current Better Auth session for the active request.
 *
 * Returns:
 * - Session and user payload when the request carries a valid auth cookie.
 * - `null` when the request is unauthenticated.
 */
export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}
