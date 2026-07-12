/**
 * Shared server-component redirect handling for merchant dashboard pages.
 * Depends on Next.js navigation redirects and the dashboard context error
 * types; unexpected loader failures are deliberately re-thrown.
 */

import { redirect } from "next/navigation";
import {
  MissingMerchantContextError,
  UnauthenticatedMerchantContextError,
} from "./server";

type MerchantPageLoader<T> = () => Promise<T>;

/**
 * Loads merchant page data and maps only known auth/context failures to route
 * redirects.
 *
 * @typeParam T - Data returned by the page-specific loader.
 * @param loader - Server-side data loader for the route.
 * @param returnTo - In-app route to restore after a successful login.
 * @returns The loader result when the request has valid merchant context.
 * @throws Unknown loader errors so genuine application failures remain visible.
 */
export async function withMerchantContext<T>(
  loader: MerchantPageLoader<T>,
  returnTo: string,
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (error instanceof MissingMerchantContextError) {
      redirect("/onboarding");
    }

    if (error instanceof UnauthenticatedMerchantContextError) {
      redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }

    throw error;
  }
}
