import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth0 } from "./lib/auth0";

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/checkouts",
  "/payments",
  "/settings",
  "/onboarding",
];

/**
 * Determines whether a request targets a merchant-app route that should only
 * render after Auth0 has established a session.
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
 * Runs the Auth0 network boundary for login, callback, logout, and rolling
 * session cookies before application routes render.
 *
 * @param request Incoming Next.js proxy request.
 * @returns Auth0 middleware response, or a login redirect for protected routes.
 */
export async function proxy(request: NextRequest) {
  if (isProtectedRoute(request.nextUrl.pathname)) {
    const session = await auth0.getSession(request);

    if (!session) {
      const loginUrl = new URL("/auth/login", request.nextUrl.origin);
      loginUrl.searchParams.set(
        "returnTo",
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      );

      return NextResponse.redirect(loginUrl);
    }
  }

  const authResponse = await auth0.middleware(request);

  // Always return the auth response.
  //
  // Note: The auth response forwards requests to your app routes by default.
  // If you need to block requests, do it before calling auth0.middleware() or
  // copy the authResponse headers except for x-middleware-next to your blocking response.
  return authResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
