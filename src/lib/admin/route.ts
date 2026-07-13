/**
 * Server-component redirect handling for the admin dashboard. Database-backed
 * admin authorization remains authoritative; redirects only shape page UX.
 */

import { redirect } from "next/navigation";
import { AdminAuthenticationError, AdminAuthorizationError } from "./server";

type AdminPageLoader<T> = () => Promise<T>;

/**
 * Loads an admin page and maps only known authentication failures to redirects.
 *
 * Parameters:
 * - loader: Server-side admin data loader.
 * - returnTo: Route restored after login.
 *
 * Returns:
 * - Loaded page data when the caller is an active admin.
 *
 * Throws:
 * - Unexpected database or queue failures so the app error boundary can show
 *   the genuine operational problem.
 */
export async function withAdminContext<T>(
  loader: AdminPageLoader<T>,
  returnTo: string,
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (error instanceof AdminAuthenticationError) {
      redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }

    if (error instanceof AdminAuthorizationError) {
      redirect("/dashboard");
    }

    throw error;
  }
}
