import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  BETTER_AUTH_SECURE_SESSION_COOKIE_NAME,
  BETTER_AUTH_SESSION_COOKIE_NAME,
} from "./lib/auth/cookies";

const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/dashboard",
  "/checkouts",
  "/payments",
  "/developers",
  "/settings",
  "/onboarding",
];

/**
 * Determines whether a request targets a merchant-app route that should only
 * render after Better Auth has established a session.
 *
 * @param pathname Request pathname from NextRequest.nextUrl.
 * @returns True when the route is part of the authenticated app surface.
 */
function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Performs an optimistic cookie presence check before protected routes render.
 * The definitive session validation still happens inside server-side route and
 * data handlers via Better Auth itself.
 *
 * @param request Incoming Next.js proxy request.
 * @returns Next.js pass-through response, or a login redirect for protected
 * routes with no auth cookie.
 */
export async function proxy(request: NextRequest) {
  if (isProtectedRoute(request.nextUrl.pathname)) {
    const hasSessionCookie =
      request.cookies.has(BETTER_AUTH_SESSION_COOKIE_NAME) ||
      request.cookies.has(BETTER_AUTH_SECURE_SESSION_COOKIE_NAME);

    if (!hasSessionCookie) {
      const loginUrl = new URL("/login", request.nextUrl.origin);
      loginUrl.searchParams.set(
        "returnTo",
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      );

      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
